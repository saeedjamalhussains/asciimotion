export interface WatermarkPattern {
  width: number;
  height: number;
  delta: Int8Array;
}

export interface ProvenanceRecord {
  version: number;
  exportedAt: number;
}

export interface WatermarkOptions {
  key?: string;
  amplitude?: number;
}

export const WATERMARK_VERSION = 1;
export const WATERMARK_BITS = 56;
export const MIN_WATERMARK_SAMPLES_PER_BIT = 448;
export const DEFAULT_WATERMARK_AMPLITUDE = 2;

// This key is embedded in a public client bundle. It provides reproducible obscurity, not security.
const DEFAULT_WATERMARK_KEY = 'ascii-motion-provenance-v1';
const MAX_CACHED_CHIP_PATTERNS = 4;
const MAX_DECODE_RESIDUAL = 96;
const MIN_RETAINED_SAMPLES_PER_BIT = 128;
const chipCache = new Map<string, Int8Array>();

function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function encodeProvenance(exportedAtSeconds: number): Uint8Array {
  if (
    !Number.isSafeInteger(exportedAtSeconds) ||
    exportedAtSeconds < 0 ||
    exportedAtSeconds > 0xffffffff
  ) {
    throw new RangeError('Export timestamp must be an unsigned 32-bit integer in seconds.');
  }

  const bytes = new Uint8Array(7);
  bytes[0] = WATERMARK_VERSION;
  bytes[1] = (exportedAtSeconds >>> 24) & 0xff;
  bytes[2] = (exportedAtSeconds >>> 16) & 0xff;
  bytes[3] = (exportedAtSeconds >>> 8) & 0xff;
  bytes[4] = exportedAtSeconds & 0xff;
  const checksum = crc16(bytes.subarray(0, 5));
  bytes[5] = (checksum >>> 8) & 0xff;
  bytes[6] = checksum & 0xff;
  return bytes;
}

export function decodeProvenance(bytes: Uint8Array): ProvenanceRecord | null {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 7 || bytes[0] !== WATERMARK_VERSION) {
    return null;
  }
  const expected = crc16(bytes.subarray(0, 5));
  if (bytes[5] !== (expected >>> 8) || bytes[6] !== (expected & 0xff)) return null;

  const exportedAt =
    bytes[1] * 0x1000000 +
    (bytes[2] << 16) +
    (bytes[3] << 8) +
    bytes[4];
  return { version: WATERMARK_VERSION, exportedAt };
}

function hashSeed(key: string, pixelCount: number): number {
  let hash = 0x811c9dc5;
  const seedText = `${key}\u0000${pixelCount}`;
  for (let index = 0; index < seedText.length; index += 1) {
    hash = Math.imul(hash ^ seedText.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

function getChipPattern(key: string, pixelCount: number): Int8Array {
  const cacheKey = `${key}\u0000${pixelCount}`;
  const cached = chipCache.get(cacheKey);
  if (cached) {
    chipCache.delete(cacheKey);
    chipCache.set(cacheKey, cached);
    return cached;
  }

  let state = hashSeed(key, pixelCount);
  const chips = new Int8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    chips[index] = (value ^ (value >>> 14)) >>> 31 ? 1 : -1;
  }

  chipCache.set(cacheKey, chips);
  if (chipCache.size > MAX_CACHED_CHIP_PATTERNS) {
    const oldestKey = chipCache.keys().next().value;
    if (oldestKey !== undefined) chipCache.delete(oldestKey);
  }
  return chips;
}

function dimensionsAreValid(width: number, height: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 2 && height > 0;
}

function greatestCommonDivisor(left: number, right: number): number {
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function rowBitStride(width: number): number {
  for (let offset = 1; offset <= WATERMARK_BITS; offset += 1) {
    const stride = width + offset;
    if (greatestCommonDivisor(stride, WATERMARK_BITS) === 1) return stride;
  }
  return width + 1;
}

function bitIndexForPixel(pixel: number, width: number, stride: number): number {
  const row = Math.floor(pixel / width);
  return (pixel - row * width + row * stride) % WATERMARK_BITS;
}

export function createWatermarkPattern(
  width: number,
  height: number,
  exportedAtSeconds: number,
  options: WatermarkOptions = {},
): WatermarkPattern | null {
  if (!dimensionsAreValid(width, height)) return null;
  const pixelCount = width * height;
  if (!Number.isSafeInteger(pixelCount)) return null;
  const usablePixels = (width - 2) * height;
  if (usablePixels / WATERMARK_BITS < MIN_WATERMARK_SAMPLES_PER_BIT) return null;

  const payload = encodeProvenance(exportedAtSeconds);
  const key = options.key ?? DEFAULT_WATERMARK_KEY;
  const amplitude = options.amplitude ?? DEFAULT_WATERMARK_AMPLITUDE;
  if (!Number.isSafeInteger(amplitude) || amplitude < 0 || amplitude > 127) return null;

  const chips = getChipPattern(key, pixelCount);
  const delta = new Int8Array(pixelCount);
  const stride = rowBitStride(width);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const bitIndex = bitIndexForPixel(pixel, width, stride);
    const byte = payload[bitIndex >>> 3];
    const bit = (byte >>> (7 - (bitIndex & 7))) & 1;
    delta[pixel] = amplitude * (bit === 1 ? 1 : -1) * chips[pixel];
  }
  return { width, height, delta };
}

export function applyWatermark(rgba: Uint8ClampedArray, pattern: WatermarkPattern): void {
  const pixelCount = pattern.width * pattern.height;
  if (
    !dimensionsAreValid(pattern.width, pattern.height) ||
    !Number.isSafeInteger(pixelCount) ||
    rgba.length !== pixelCount * 4 ||
    pattern.delta.length !== pixelCount
  ) {
    return;
  }

  for (let pixel = 0, offset = 0; pixel < pixelCount; pixel += 1, offset += 4) {
    if (rgba[offset + 3] === 0) continue;
    const delta = pattern.delta[pixel];
    rgba[offset] += delta;
    rgba[offset + 1] += delta;
    rgba[offset + 2] += delta;
  }
}

export function readWatermark(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: Pick<WatermarkOptions, 'key'> = {},
): ProvenanceRecord | null {
  if (!dimensionsAreValid(width, height)) return null;
  const pixelCount = width * height;
  if (
    !Number.isSafeInteger(pixelCount) ||
    rgba.length !== pixelCount * 4 ||
    ((width - 2) * height) / WATERMARK_BITS < MIN_WATERMARK_SAMPLES_PER_BIT
  ) {
    return null;
  }

  const chips = getChipPattern(options.key ?? DEFAULT_WATERMARK_KEY, pixelCount);
  const correlations = new Float64Array(WATERMARK_BITS);
  const sampleCounts = new Uint32Array(WATERMARK_BITS);
  const stride = rowBitStride(width);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = row + x;
      const offset = pixel * 4;
      if (rgba[offset + 3] === 0) continue;
      const left = offset - 4;
      const right = offset + 4;
      const centerSum = rgba[offset] + rgba[offset + 1] + rgba[offset + 2];
      const leftSum = rgba[left] + rgba[left + 1] + rgba[left + 2];
      const rightSum = rgba[right] + rgba[right + 1] + rgba[right + 2];
      const residual = centerSum - (leftSum + rightSum) / 2;
      // Strong host-image edges dominate the correlation but do not separate the low-amplitude mark.
      if (Math.abs(residual) > MAX_DECODE_RESIDUAL) continue;
      const bitIndex = bitIndexForPixel(pixel, width, stride);
      correlations[bitIndex] += residual * chips[pixel];
      sampleCounts[bitIndex] += 1;
    }
  }

  for (const count of sampleCounts) {
    if (count < MIN_RETAINED_SAMPLES_PER_BIT) return null;
  }

  const payload = new Uint8Array(7);
  for (let bitIndex = 0; bitIndex < WATERMARK_BITS; bitIndex += 1) {
    if (correlations[bitIndex] > 0) {
      payload[bitIndex >>> 3] |= 1 << (7 - (bitIndex & 7));
    }
  }
  return decodeProvenance(payload);
}
