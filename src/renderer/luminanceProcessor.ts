import type { EditorSettings } from '../types';

/**
 * Per-cell image pipeline. Operates on the already-downscaled sample buffer
 * (cols x rows), so the amount of work is bounded by the ASCII grid rather
 * than the source video resolution — a 4K clip at 80 columns processes ~4k
 * pixels per frame, not 8 million.
 */

export interface ToneCurve {
  /** 256-entry LUT applied to each channel and to luma. */
  lut: Uint8Array;
  key: string;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Builds a combined exposure -> brightness -> contrast -> gamma -> invert LUT.
 * Cached by the caller via `key`.
 *
 * Gamma follows the Levels convention used by Photoshop and GIMP — the curve is
 * `output = input ^ (1 / gamma)`, so values above 1 lift mid-tones and values
 * below 1 deepen them.
 */
export function buildToneCurve(settings: EditorSettings): ToneCurve {
  const { brightness, contrast, gamma, exposure, invert } = settings;
  const key = `${brightness}|${contrast}|${gamma}|${exposure}|${invert}`;
  const lut = new Uint8Array(256);

  // Exposure is a multiplicative stop adjustment; brightness is additive.
  const exposureGain = Math.pow(2, exposure / 100);
  const brightnessOffset = (brightness / 100) * 255 * 0.6;
  // Standard contrast factor, smooth across the -100..100 range.
  const c = Math.max(-99, Math.min(100, contrast));
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));
  const invGamma = 1 / Math.max(0.05, gamma);

  for (let i = 0; i < 256; i += 1) {
    let v = i * exposureGain + brightnessOffset;
    v = contrastFactor * (v - 128) + 128;
    v = clamp255(v);
    v = 255 * Math.pow(v / 255, invGamma);
    v = clamp255(v);
    lut[i] = invert ? 255 - Math.round(v) : Math.round(v);
  }
  return { lut, key };
}

/**
 * Applies the tone curve in place and writes Rec.709 luma into `luma`.
 * Returns nothing; both buffers are caller-owned and reused across frames.
 */
export function applyToneAndLuma(
  pixels: Uint8ClampedArray,
  luma: Uint8Array,
  count: number,
  lut: Uint8Array,
): void {
  for (let i = 0, p = 0; i < count; i += 1, p += 4) {
    const r = lut[pixels[p]];
    const g = lut[pixels[p + 1]];
    const b = lut[pixels[p + 2]];
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    // 0.2126 / 0.7152 / 0.0722 in 16.16 fixed point.
    luma[i] = (r * 13933 + g * 46871 + b * 4732) >> 16;
  }
}

/**
 * 3x3 unsharp mask on the luma plane. `amount` is 0..100.
 * Writes into `out` (a separate buffer) to avoid feedback.
 */
export function sharpen(
  luma: Uint8Array,
  out: Uint8Array,
  cols: number,
  rows: number,
  amount: number,
): void {
  const k = amount / 100;
  if (k <= 0 || cols < 3 || rows < 3) {
    out.set(luma.subarray(0, cols * rows));
    return;
  }
  for (let y = 0; y < rows; y += 1) {
    const up = y > 0 ? (y - 1) * cols : 0;
    const mid = y * cols;
    const down = y < rows - 1 ? (y + 1) * cols : mid;
    for (let x = 0; x < cols; x += 1) {
      const xl = x > 0 ? x - 1 : 0;
      const xr = x < cols - 1 ? x + 1 : x;
      const blur =
        (luma[up + xl] +
          luma[up + x] * 2 +
          luma[up + xr] +
          luma[mid + xl] * 2 +
          luma[mid + x] * 4 +
          luma[mid + xr] * 2 +
          luma[down + xl] +
          luma[down + x] * 2 +
          luma[down + xr]) /
        16;
      const value = luma[mid + x] + (luma[mid + x] - blur) * k * 2.5;
      out[mid + x] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
  }
}
