import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyWatermark,
  createWatermarkPattern,
  decodeProvenance,
  encodeProvenance,
  MIN_WATERMARK_SAMPLES_PER_BIT,
  readWatermark,
} from '../src/video/watermark';

const WIDTH = 640;
const HEIGHT = 360;
const TIMESTAMP = 1_791_388_800;
const KEY = 'watermark-test-key';

function asciiFrame(width: number, height: number, value: number | null = null): Uint8ClampedArray {
  const glyphs = [
    [14, 17, 17, 31, 17, 17, 17],
    [15, 16, 16, 14, 1, 1, 30],
    [14, 17, 16, 16, 16, 17, 14],
    [31, 4, 4, 4, 4, 4, 31],
    [17, 27, 21, 21, 17, 17, 17],
    [14, 17, 17, 17, 17, 17, 14],
  ];
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx = x % 8;
      const gy = y % 14;
      const glyph = glyphs[(Math.floor(x / 8) * 3 + Math.floor(y / 14) * 5) % glyphs.length];
      const ink =
        gx >= 1 &&
        gx <= 5 &&
        gy >= 1 &&
        gy <= 13 &&
        ((glyph[Math.floor((gy - 1) / 2)] >> (5 - gx)) & 1) === 1;
      const shade = value === null ? (ink ? 224 : 18) : value;
      const offset = (y * width + x) * 4;
      rgba[offset] = shade;
      rgba[offset + 1] = shade;
      rgba[offset + 2] = shade;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function stampedFrame(
  width = WIDTH,
  height = HEIGHT,
  value: number | null = null,
  amplitude = 2,
): { pixels: Uint8ClampedArray; original: Uint8ClampedArray } {
  const original = asciiFrame(width, height, value);
  const pixels = new Uint8ClampedArray(original);
  const pattern = createWatermarkPattern(width, height, TIMESTAMP, { key: KEY, amplitude });
  assert.ok(pattern, 'frame should have enough samples for the payload');
  applyWatermark(pixels, pattern);
  return { pixels, original };
}

function seededNoise(pixels: Uint8ClampedArray, seed: number): void {
  let state = seed | 0;
  for (let index = 0; index < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) | 0;
      pixels[index + channel] += ((state >>> 28) % 9) - 4;
    }
  }
}

describe('pixel provenance watermark', () => {
  it('round-trips the timestamp from a synthetic ASCII-like frame', () => {
    const { pixels } = stampedFrame();
    assert.deepEqual(readWatermark(pixels, WIDTH, HEIGHT, { key: KEY }), {
      version: 1,
      exportedAt: TIMESTAMP,
    });
  });

  it('keeps channel deltas bounded, alpha unchanged, and PSNR above 40 dB', () => {
    const { pixels, original } = stampedFrame();
    let squaredError = 0;
    let channelCount = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      assert.equal(pixels[index + 3], original[index + 3]);
      for (let channel = 0; channel < 3; channel += 1) {
        const difference = Math.abs(pixels[index + channel] - original[index + channel]);
        assert.ok(difference <= 2);
        squaredError += difference * difference;
        channelCount += 1;
      }
    }
    const meanSquaredError = squaredError / channelCount;
    const psnr = 10 * Math.log10((255 * 255) / meanSquaredError);
    assert.ok(psnr >= 40, `measured PSNR ${psnr.toFixed(2)} dB`);
  });

  it('rejects unmarked frames and frames read with the wrong key', () => {
    const unmarked = asciiFrame(WIDTH, HEIGHT);
    assert.equal(readWatermark(unmarked, WIDTH, HEIGHT, { key: KEY }), null);
    const { pixels } = stampedFrame();
    assert.equal(readWatermark(pixels, WIDTH, HEIGHT, { key: 'another-key' }), null);
  });

  it('survives seeded additive noise of +/-4 and 4-level RGB quantization', () => {
    const noisy = stampedFrame().pixels;
    seededNoise(noisy, 0x51f15e);
    assert.deepEqual(readWatermark(noisy, WIDTH, HEIGHT, { key: KEY }), {
      version: 1,
      exportedAt: TIMESTAMP,
    });

    const quantized = stampedFrame().pixels;
    for (let index = 0; index < quantized.length; index += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        quantized[index + channel] = Math.round(quantized[index + channel] / 4) * 4;
      }
    }
    assert.deepEqual(readWatermark(quantized, WIDTH, HEIGHT, { key: KEY }), {
      version: 1,
      exportedAt: TIMESTAMP,
    });
  });

  it('decodes clamped black and white frames without changing alpha', () => {
    for (const shade of [0, 255]) {
      const { pixels, original } = stampedFrame(WIDTH, HEIGHT, shade);
      assert.deepEqual(readWatermark(pixels, WIDTH, HEIGHT, { key: KEY }), {
        version: 1,
        exportedAt: TIMESTAMP,
      });
      for (let index = 3; index < pixels.length; index += 4) {
        assert.equal(pixels[index], original[index]);
      }
    }
  });

  it('leaves fully transparent pixels unchanged and decodes visible glyph pixels', () => {
    const original = asciiFrame(WIDTH, HEIGHT);
    for (let offset = 0; offset < original.length; offset += 4) {
      if (original[offset] === 18) {
        original[offset] = 0;
        original[offset + 1] = 0;
        original[offset + 2] = 0;
        original[offset + 3] = 0;
      }
    }
    const pixels = new Uint8ClampedArray(original);
    const pattern = createWatermarkPattern(WIDTH, HEIGHT, TIMESTAMP, { key: KEY });
    assert.ok(pattern);
    assert.doesNotThrow(() => applyWatermark(pixels, pattern));
    for (let offset = 0; offset < pixels.length; offset += 4) {
      assert.equal(pixels[offset + 3], original[offset + 3]);
      if (original[offset + 3] === 0) {
        assert.deepEqual(pixels.subarray(offset, offset + 3), original.subarray(offset, offset + 3));
      }
    }
    assert.deepEqual(readWatermark(pixels, WIDTH, HEIGHT, { key: KEY }), {
      version: 1,
      exportedAt: TIMESTAMP,
    });
  });

  it('skips frames below the empirical sample threshold and rejects narrow dimensions', () => {
    const tooSmall = asciiFrame(64, 64);
    assert.equal(createWatermarkPattern(64, 64, TIMESTAMP, { key: KEY }), null);
    assert.equal(readWatermark(tooSmall, 64, 64, { key: KEY }), null);
    assert.equal(createWatermarkPattern(128, 128, TIMESTAMP, { key: KEY }), null);
    assert.equal(createWatermarkPattern(1, 5000, TIMESTAMP, { key: KEY }), null);
    assert.equal(readWatermark(new Uint8ClampedArray(4 * 5000), 1, 5000, { key: KEY }), null);
    assert.equal(MIN_WATERMARK_SAMPLES_PER_BIT, 448);
    const minimumSize = stampedFrame(160, 160).pixels;
    assert.deepEqual(readWatermark(minimumSize, 160, 160, { key: KEY }), {
      version: 1,
      exportedAt: TIMESTAMP,
    });
  });

  it('is deterministic and produces a different mark for a different timestamp', () => {
    const first = createWatermarkPattern(WIDTH, HEIGHT, TIMESTAMP, { key: KEY });
    const second = createWatermarkPattern(WIDTH, HEIGHT, TIMESTAMP, { key: KEY });
    const later = createWatermarkPattern(WIDTH, HEIGHT, TIMESTAMP + 1, { key: KEY });
    assert.ok(first && second && later);
    assert.deepEqual(first.delta, second.delta);
    assert.notDeepEqual(first.delta, later.delta);
    assert.notDeepEqual(encodeProvenance(TIMESTAMP), encodeProvenance(TIMESTAMP + 1));
  });

  it('handles CRC failures, truncated data, mismatched buffers, and odd widths safely', () => {
    const encoded = encodeProvenance(TIMESTAMP);
    assert.deepEqual(decodeProvenance(encoded), { version: 1, exportedAt: TIMESTAMP });
    encoded[2] ^= 1;
    assert.equal(decodeProvenance(encoded), null);

    const { pixels } = stampedFrame();
    assert.doesNotThrow(() => applyWatermark(new Uint8ClampedArray(pixels.length - 1), {
      width: WIDTH,
      height: HEIGHT,
      delta: new Int8Array(WIDTH * HEIGHT),
    }));
    assert.equal(readWatermark(pixels.subarray(0, pixels.length - 4), WIDTH, HEIGHT, { key: KEY }), null);

    const odd = stampedFrame(641, 360).pixels;
    assert.deepEqual(readWatermark(odd, 641, 360, { key: KEY }), {
      version: 1,
      exportedAt: TIMESTAMP,
    });
  });
});
