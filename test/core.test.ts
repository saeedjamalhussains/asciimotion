import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeGeometry, DEFAULT_ADVANCE_RATIO } from '../src/renderer/canvasRenderer';
import {
  buildLuminanceLut,
  mapWithDither,
  mapWithLut,
  parseRamp,
  rampPreview,
} from '../src/renderer/characterMapper';
import { applyToneAndLuma, buildToneCurve, sharpen } from '../src/renderer/luminanceProcessor';
import { CHARSET_PRESETS, DEFAULT_SETTINGS, RESOLUTION_STEPS } from '../src/state/settings';
import { clamp, cropForAspect, fitInside, ratioFor } from '../src/utils/aspectRatio';
import { buildExportFilename, sanitizeFilenameStem } from '../src/utils/fileHandling';
import { formatBytes, formatTime, formatTimePrecise } from '../src/utils/formatTime';
import { hexToRgb, isValidHex, normalizeHex, rgbToHex } from '../src/utils/color';
import { buildTicks, ratioToTime, timeToRatio } from '../src/video/timeline';
import { clampPlayhead, clampTrim, MIN_TRIM_DURATION, trimDuration } from '../src/video/trim';
import type { EditorSettings } from '../src/types';

/**
 * Regression net for the ASCII engine.
 *
 * These cover the pure core — geometry, tone mapping, character mapping,
 * trimming and framing — so a UI change cannot silently break the pipeline.
 */

const BASE_GEOMETRY = {
  fontSize: DEFAULT_SETTINGS.fontSize,
  letterSpacing: DEFAULT_SETTINGS.letterSpacing,
  lineSpacing: DEFAULT_SETTINGS.lineSpacing,
  fontFamily: DEFAULT_SETTINGS.fontFamily,
  maxWidth: 1494,
  maxHeight: 892,
};

describe('grid geometry', () => {
  it('preserves a 16:9 source exactly at the default settings', () => {
    const g = computeGeometry({ ...BASE_GEOMETRY, cols: 120, sourceRatio: 16 / 9 });
    assert.equal(g.cols, 120);
    assert.equal(g.width / g.height, 16 / 9);
  });

  it('keeps aspect error small across the settings matrix', () => {
    // A grid only a handful of rows tall can only approximate a ratio: with 5
    // rows, one row is a 20% step. So the bound is loose overall and tight for
    // any grid of a usable size.
    const ratios = [16 / 9, 9 / 16, 1, 4 / 3];
    let worst = 0;
    let worstCase = '';
    let worstUsable = 0;
    let worstUsableCase = '';
    for (const cols of RESOLUTION_STEPS) {
      for (const fontSize of [8, 10, 14, 20]) {
        for (const letterSpacing of [-0.3, 0, 0.3, 0.6]) {
          for (const lineSpacing of [0.8, 1, 1.4, 1.6]) {
            for (const sourceRatio of ratios) {
              const g = computeGeometry({
                ...BASE_GEOMETRY,
                cols,
                fontSize,
                letterSpacing,
                lineSpacing,
                sourceRatio,
              });
              const error = Math.abs(g.width / g.height - sourceRatio) / sourceRatio;
              const label = `cols=${cols} font=${fontSize} ls=${letterSpacing} lsp=${lineSpacing} ratio=${sourceRatio.toFixed(3)} -> ${g.cols}x${g.rows}`;
              if (error > worst) {
                worst = error;
                worstCase = label;
              }
              if (g.rows >= 12 && error > worstUsable) {
                worstUsable = error;
                worstUsableCase = label;
              }
            }
          }
        }
      }
    }
    assert.ok(worst < 0.05, `worst aspect error ${(worst * 100).toFixed(2)}% at ${worstCase}`);
    // Known limit: the grid is quantised to whole cells in both axes, so some
    // column/spacing combinations cannot land on the exact ratio. Defaults are
    // exact; this bound pins the worst case so it cannot silently get worse.
    assert.ok(
      worstUsable < 0.035,
      `worst aspect error on a 12+ row grid was ${(worstUsable * 100).toFixed(2)}% at ${worstUsableCase}`,
    );
  });

  it('scales the raster to the pixel budget without changing framing', () => {
    const big = computeGeometry({ ...BASE_GEOMETRY, cols: 320, sourceRatio: 16 / 9 });
    const small = computeGeometry({
      ...BASE_GEOMETRY,
      cols: 320,
      sourceRatio: 16 / 9,
      maxWidth: 600,
      maxHeight: 400,
    });
    assert.ok(small.width < big.width, 'a tighter budget must shrink the raster');
    // Cells are whole pixels, so the raster can round up by at most one pixel
    // per cell. Rounding up beats rounding down here: at 320 columns in a 600px
    // box, 2px cells (640 wide, scaled down by CSS) are far sharper than 1px.
    assert.ok(small.width <= 600 + small.cols, `width ${small.width} overshot the budget`);
    assert.ok(small.height <= 400 + small.rows, `height ${small.height} overshot the budget`);
    assert.ok(
      Math.abs(big.width / big.height - small.width / small.height) < 0.02,
      'framing must survive the rescale',
    );
  });

  it('lands close to an exact export target', () => {
    const g = computeGeometry({
      ...BASE_GEOMETRY,
      cols: 120,
      sourceRatio: 16 / 9,
      targetWidth: 1280,
      targetHeight: 720,
    });
    // Cell sizes are whole pixels, so the raster lands near — not exactly on —
    // the target; the exporter's contain-fit letterboxes it into the precise
    // frame. What matters is that it is close and correctly proportioned.
    assert.ok(Math.abs(g.width - 1280) / 1280 < 0.05, `width ${g.width} too far from 1280`);
    assert.ok(Math.abs(g.height - 720) / 720 < 0.05, `height ${g.height} too far from 720`);
    assert.ok(Math.abs(g.width / g.height - 16 / 9) / (16 / 9) < 0.015);
    assert.ok(g.width >= 1000, 'should make real use of the target resolution');
  });

  it('falls back to a sane advance ratio with no canvas available', () => {
    assert.equal(DEFAULT_ADVANCE_RATIO, 0.6);
    const g = computeGeometry({ ...BASE_GEOMETRY, cols: 80, sourceRatio: 1 });
    assert.ok(g.cellW > 0 && g.cellH > 0 && g.rows > 0);
  });
});

describe('character mapping', () => {
  it('parses every shipped preset, surrogate-safe', () => {
    for (const preset of CHARSET_PRESETS) {
      if (preset.id === 'custom') continue;
      const ramp = parseRamp(preset.ramp, CHARSET_PRESETS[0].ramp);
      assert.ok(ramp.chars.length > 1, `${preset.id} should have multiple glyphs`);
      assert.equal(ramp.chars.join(''), preset.ramp);
    }
  });

  it('falls back when the ramp is empty', () => {
    assert.equal(parseRamp('', '@#.').chars.join(''), '@#.');
  });

  it('maps bright pixels to the densest glyph on a dark background', () => {
    const lut = buildLuminanceLut(10, false);
    assert.equal(lut[255], 0, 'brightest pixel -> index 0 (densest)');
    assert.equal(lut[0], 9, 'darkest pixel -> last index (sparsest)');
  });

  it('flips the mapping on a light background', () => {
    const lut = buildLuminanceLut(10, true);
    assert.equal(lut[0], 0);
    assert.equal(lut[255], 9);
  });

  it('never produces an out-of-range index', () => {
    for (const length of [2, 5, 12, 69]) {
      for (const flipped of [false, true]) {
        const lut = buildLuminanceLut(length, flipped);
        for (let i = 0; i < 256; i += 1) {
          assert.ok(lut[i] >= 0 && lut[i] < length, `index ${lut[i]} out of range`);
        }
      }
    }
  });

  it('dithers within range and stays deterministic', () => {
    const cols = 16;
    const rows = 8;
    const luma = new Uint8Array(cols * rows).fill(128);
    const a = new Uint8Array(cols * rows);
    const b = new Uint8Array(cols * rows);
    mapWithDither(luma, a, cols, rows, 4, false);
    mapWithDither(luma, b, cols, rows, 4, false);
    assert.deepEqual(Array.from(a), Array.from(b), 'same input must give same output');
    for (const value of a) assert.ok(value >= 0 && value < 4);
    assert.ok(new Set(a).size > 1, 'flat input should still produce tonal variation');
  });

  it('mapWithLut matches the lookup table', () => {
    const lut = buildLuminanceLut(8, false);
    const luma = Uint8Array.from([0, 64, 128, 192, 255]);
    const out = new Uint8Array(5);
    mapWithLut(luma, out, 5, lut);
    assert.deepEqual(Array.from(out), Array.from(luma).map((v) => lut[v]));
  });

  it('previews long ramps without exceeding the limit', () => {
    const dense = CHARSET_PRESETS.find((p) => p.id === 'dense')!;
    assert.equal(Array.from(rampPreview(dense.ramp, 12)).length, 12);
    assert.equal(rampPreview('ab', 12), 'ab');
  });
});

describe('tone curve', () => {
  const base = (patch: Partial<EditorSettings> = {}): EditorSettings => ({
    ...DEFAULT_SETTINGS,
    brightness: 0,
    contrast: 0,
    gamma: 1,
    exposure: 0,
    invert: false,
    ...patch,
  });

  it('is identity at neutral settings', () => {
    const { lut } = buildToneCurve(base());
    for (const v of [0, 1, 64, 128, 200, 255]) assert.equal(lut[v], v);
  });

  it('inverts', () => {
    const { lut } = buildToneCurve(base({ invert: true }));
    assert.equal(lut[0], 255);
    assert.equal(lut[255], 0);
  });

  it('brightness and contrast move mid-tones the expected way', () => {
    assert.ok(buildToneCurve(base({ brightness: 50 })).lut[128] > 128);
    assert.ok(buildToneCurve(base({ brightness: -50 })).lut[128] < 128);
    assert.ok(buildToneCurve(base({ contrast: 60 })).lut[200] >= buildToneCurve(base()).lut[200]);
    assert.ok(buildToneCurve(base({ contrast: 60 })).lut[50] <= buildToneCurve(base()).lut[50]);
  });

  it('gamma above 1 brightens mid-tones, below 1 darkens them', () => {
    // Matches the Levels-style convention used by Photoshop and GIMP:
    // output = input ^ (1 / gamma).
    assert.ok(buildToneCurve(base({ gamma: 2 })).lut[128] > 128, 'gamma 2 should brighten');
    assert.ok(buildToneCurve(base({ gamma: 0.5 })).lut[128] < 128, 'gamma 0.5 should darken');
    assert.equal(buildToneCurve(base({ gamma: 1 })).lut[128], 128, 'gamma 1 is neutral');
  });

  it('stays in range for every extreme combination', () => {
    for (const brightness of [-100, 0, 100]) {
      for (const contrast of [-100, 0, 100]) {
        for (const gamma of [0.5, 1, 2]) {
          for (const exposure of [-100, 0, 100]) {
            const { lut } = buildToneCurve(base({ brightness, contrast, gamma, exposure }));
            for (let i = 0; i < 256; i += 1) {
              assert.ok(lut[i] >= 0 && lut[i] <= 255, `out of range: ${lut[i]}`);
              assert.ok(Number.isInteger(lut[i]));
            }
          }
        }
      }
    }
  });

  it('caches by a key that captures every input', () => {
    assert.notEqual(buildToneCurve(base()).key, buildToneCurve(base({ gamma: 1.5 })).key);
    assert.equal(buildToneCurve(base()).key, buildToneCurve(base()).key);
  });

  it('computes Rec.709 luma from adjusted pixels', () => {
    const { lut } = buildToneCurve(base());
    const pixels = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 0, 255, 0, 255]);
    const luma = new Uint8Array(3);
    applyToneAndLuma(pixels, luma, 3, lut);
    assert.equal(luma[0], 255);
    assert.equal(luma[1], 0);
    assert.ok(luma[2] > 170 && luma[2] < 190, `green luma was ${luma[2]}`);
  });
});

describe('sharpen', () => {
  it('is a pass-through at zero amount', () => {
    const luma = Uint8Array.from({ length: 25 }, (_, i) => i * 10);
    const out = new Uint8Array(25);
    sharpen(luma, out, 5, 5, 0);
    assert.deepEqual(Array.from(out), Array.from(luma));
  });

  it('increases local contrast and stays in range', () => {
    const luma = new Uint8Array(25).fill(40);
    luma[12] = 200;
    const out = new Uint8Array(25);
    sharpen(luma, out, 5, 5, 100);
    assert.ok(out[12] >= luma[12], 'the peak should not be reduced');
    for (const v of out) assert.ok(v >= 0 && v <= 255);
  });
});

describe('framing', () => {
  it('returns the full frame when the ratio already matches', () => {
    const crop = cropForAspect(1920, 1080, 16 / 9);
    assert.deepEqual(crop, { sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it('centre-crops horizontally for a taller target', () => {
    const crop = cropForAspect(1920, 1080, 9 / 16);
    assert.equal(crop.sh, 1080);
    assert.equal(crop.sw, Math.round(1080 * (9 / 16)));
    assert.equal(crop.sx, Math.round((1920 - crop.sw) / 2));
    assert.ok(crop.sw <= 1920 && crop.sh <= 1080, 'crop must stay inside the source');
  });

  it('centre-crops vertically for a wider target', () => {
    const crop = cropForAspect(1080, 1920, 16 / 9);
    assert.equal(crop.sw, 1080);
    assert.equal(crop.sh, Math.round(1080 / (16 / 9)));
    assert.equal(crop.sy, Math.round((1920 - crop.sh) / 2));
  });

  it('resolves preset ratios, with "original" following the source', () => {
    assert.equal(ratioFor('original', 2.35), 2.35);
    assert.equal(ratioFor('16:9', 1), 16 / 9);
    assert.equal(ratioFor('1:1', 1.77), 1);
  });

  it('fits inside a box without overflowing', () => {
    const fit = fitInside(800, 400, 16 / 9);
    assert.ok(fit.w <= 800 && fit.h <= 400);
    assert.ok(Math.abs(fit.w / fit.h - 16 / 9) < 0.02);
  });

  it('clamps', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(50, 0, 10), 10);
  });
});

describe('trimming', () => {
  it('keeps the range inside the clip', () => {
    assert.deepEqual(clampTrim({ start: -5, end: 999 }, 10), { start: 0, end: 10 });
  });

  it('enforces a minimum duration', () => {
    const t = clampTrim({ start: 5, end: 5 }, 10);
    // Compared with a small epsilon: 5.1 - 5 is 0.09999999999999964 in binary
    // floating point, which is the intended 0.1.
    assert.ok(t.end - t.start >= MIN_TRIM_DURATION - 1e-9, `got ${t.end - t.start}`);
  });

  it('never lets the end precede the start', () => {
    const t = clampTrim({ start: 8, end: 2 }, 10);
    assert.ok(t.end > t.start, `${t.start} -> ${t.end}`);
  });

  it('survives a zero-length or invalid duration', () => {
    const t = clampTrim({ start: 0, end: 5 }, 0);
    assert.ok(Number.isFinite(t.start) && Number.isFinite(t.end));
    assert.ok(t.end >= t.start);
  });

  it('measures and clamps the playhead', () => {
    assert.equal(trimDuration({ start: 2, end: 5 }), 3);
    assert.equal(clampPlayhead(1, { start: 2, end: 5 }), 2);
    assert.equal(clampPlayhead(9, { start: 2, end: 5 }), 5);
    assert.equal(clampPlayhead(3, { start: 2, end: 5 }), 3);
  });
});

describe('timeline mapping', () => {
  it('round-trips time and ratio', () => {
    assert.equal(timeToRatio(5, 10), 0.5);
    assert.equal(ratioToTime(0.5, 10), 5);
    assert.equal(timeToRatio(50, 10), 1, 'clamped');
    assert.equal(timeToRatio(5, 0), 0, 'no division by zero');
  });

  it('builds ticks that span the clip', () => {
    const ticks = buildTicks(12, 6);
    assert.ok(ticks.length > 1);
    assert.equal(ticks[0], 0);
    assert.ok(ticks[ticks.length - 1] <= 12.0001);
  });
});

describe('naming and formatting', () => {
  it('builds a safe export filename', () => {
    assert.equal(buildExportFilename('My Clip (final).mov', 'webm'), 'ascii-motion-my-clip-final.webm');
    assert.equal(buildExportFilename('', 'gif'), 'ascii-motion-export.gif');
    assert.ok(!buildExportFilename('a/b\\c:d*.mp4', 'mp4').match(/[/\\:*]/));
  });

  it('keeps stems bounded', () => {
    assert.ok(sanitizeFilenameStem('x'.repeat(200)).length <= 48);
  });

  it('formats time and size', () => {
    assert.equal(formatTime(0), '00:00');
    assert.equal(formatTime(7), '00:07');
    assert.equal(formatTime(84), '01:24');
    assert.equal(formatTime(3671), '1:01:11');
    assert.equal(formatTime(-5), '00:00');
    assert.equal(formatTime(Number.NaN), '00:00');
    assert.equal(formatTimePrecise(1.5), '00:01.500');
    assert.equal(formatBytes(null), '—');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1536), '1.5 KB');
  });

  it('handles colour conversion', () => {
    assert.deepEqual(hexToRgb('#7df0c4'), { r: 125, g: 240, b: 196 });
    assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
    assert.equal(rgbToHex({ r: 125, g: 240, b: 196 }), '#7df0c4');
    assert.equal(normalizeHex('7DF0C4'), '#7df0c4');
    assert.ok(isValidHex('#abc') && isValidHex('aabbcc'));
    assert.ok(!isValidHex('nope'));
  });
});
