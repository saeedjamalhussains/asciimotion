/**
 * Maps luminance values onto a character ramp.
 *
 * Ramps are authored densest-glyph-first. On a dark background a *bright*
 * source pixel should be drawn with the heaviest glyph (more lit ink), so the
 * default mapping is `index = (1 - luma) * (len - 1)`. On a white background
 * the relationship flips, because ink is now dark.
 */

const BAYER_8 = new Float32Array([
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60,
  28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47,
  7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]).map((v) => v / 64 - 0.5);

export interface CharRamp {
  /** Individual glyphs, surrogate-pair safe. */
  chars: string[];
  key: string;
}

export function parseRamp(raw: string, fallback: string): CharRamp {
  const source = raw.length > 0 ? raw : fallback;
  const chars = Array.from(source);
  if (chars.length === 0) return { chars: [' '], key: ' ' };
  return { chars, key: source };
}

/**
 * Builds a 256-entry lookup so per-cell mapping is a single array read.
 */
export function buildLuminanceLut(rampLength: number, flipped: boolean): Uint8Array {
  const lut = new Uint8Array(256);
  const last = Math.max(0, rampLength - 1);
  for (let i = 0; i < 256; i += 1) {
    const t = flipped ? i / 255 : 1 - i / 255;
    lut[i] = Math.min(last, Math.round(t * last));
  }
  return lut;
}

/**
 * Ordered-dither variant: adds a deterministic Bayer offset before quantising,
 * which recovers tonal steps a short ramp would otherwise crush.
 */
export function mapWithDither(
  luma: Uint8Array,
  out: Uint8Array,
  cols: number,
  rows: number,
  rampLength: number,
  flipped: boolean,
): void {
  const last = Math.max(0, rampLength - 1);
  const levels = Math.max(1, last);
  for (let y = 0; y < rows; y += 1) {
    const rowOffset = (y & 7) * 8;
    for (let x = 0; x < cols; x += 1) {
      const i = y * cols + x;
      const t = flipped ? luma[i] / 255 : 1 - luma[i] / 255;
      const dithered = t + BAYER_8[rowOffset + (x & 7)] / levels;
      const index = Math.round(dithered * last);
      out[i] = index < 0 ? 0 : index > last ? last : index;
    }
  }
}

export function mapWithLut(
  luma: Uint8Array,
  out: Uint8Array,
  count: number,
  lut: Uint8Array,
): void {
  for (let i = 0; i < count; i += 1) out[i] = lut[luma[i]];
}

/** Human-readable preview of a ramp, used in the character picker. */
export function rampPreview(ramp: string, max = 26): string {
  const chars = Array.from(ramp);
  if (chars.length <= max) return chars.join('');
  const step = (chars.length - 1) / (max - 1);
  let out = '';
  for (let i = 0; i < max; i += 1) out += chars[Math.round(i * step)];
  return out;
}
