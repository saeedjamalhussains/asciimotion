import { CHARSET_PRESETS } from '../state/settings';
import type { EditorSettings } from '../types';
import { cropForAspect, ratioFor, type CropRect } from '../utils/aspectRatio';
import {
  buildGlyphAtlas,
  computeGeometry,
  createCanvas,
  get2d,
  resizeCanvas,
  type AnyCanvas,
  type Ctx2D,
  type GlyphAtlas,
  type GridGeometry,
} from './canvasRenderer';
import { buildLuminanceLut, mapWithDither, mapWithLut, parseRamp } from './characterMapper';
import { accentColorFor, backgroundColor, paintThroughMask, resolveColorFill } from './colorProcessor';
import { applyGlow, applyPostEffects, type EffectContext } from './effectsProcessor';
import { applyToneAndLuma, buildToneCurve, sharpen } from './luminanceProcessor';

const DEFAULT_RAMP = CHARSET_PRESETS[0].ramp;

export interface RenderRequest {
  settings: EditorSettings;
  /** Natural pixel size of the source. */
  sourceWidth: number;
  sourceHeight: number;
  /** Monotonic frame counter — drives all deterministic effects. */
  frameIndex: number;
  /** Pixel budget for the raster (preview) or an exact target (export). */
  maxWidth: number;
  maxHeight: number;
  targetWidth?: number;
  targetHeight?: number;
}

export interface RenderInfo extends GridGeometry {
  crop: CropRect;
  charCount: number;
}

/**
 * Turns a video frame into an ASCII raster.
 *
 * The pipeline is:
 *
 *   frame -> GPU downscale to the character grid -> tone curve + luma ->
 *   sharpen -> character mapping -> glyph atlas blit -> colour composite ->
 *   effects -> output canvas
 *
 * The only per-pixel JavaScript runs on the `cols x rows` sample buffer, which
 * is at most 320x240 even for a 4K source.
 */
export class AsciiRenderer {
  private readonly output: AnyCanvas;
  private readonly ctx: Ctx2D;

  private sampleCanvas: AnyCanvas;
  private sampleCtx: Ctx2D;
  private glyphCanvas: AnyCanvas;
  private glyphCtx: Ctx2D;
  private scratchCanvas: AnyCanvas;

  private atlas: GlyphAtlas | null = null;
  private atlasKey = '';

  private lumaBuffer = new Uint8Array(0);
  private sharpBuffer = new Uint8Array(0);
  private indexBuffer = new Uint8Array(0);

  private toneLut: Uint8Array = new Uint8Array(256);
  private toneKey = '';
  private rampLut: Uint8Array = new Uint8Array(256);
  private rampLutKey = '';

  private lastInfo: RenderInfo | null = null;
  private lastCharset = DEFAULT_RAMP;

  constructor(output: AnyCanvas) {
    this.output = output;
    this.ctx = get2d(output, { alpha: true, desynchronized: true });
    this.sampleCanvas = createCanvas(2, 2);
    this.sampleCtx = get2d(this.sampleCanvas, { willReadFrequently: true });
    this.glyphCanvas = createCanvas(2, 2);
    this.glyphCtx = get2d(this.glyphCanvas);
    this.scratchCanvas = createCanvas(2, 2);
  }

  get canvas(): AnyCanvas {
    return this.output;
  }

  get info(): RenderInfo | null {
    return this.lastInfo;
  }

  /** Computes geometry without drawing — used to size the preview surface. */
  measure(request: RenderRequest): RenderInfo {
    const { settings, sourceWidth, sourceHeight } = request;
    const sourceRatio = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
    const targetRatio = ratioFor(settings.aspectRatio, sourceRatio);
    const crop = cropForAspect(sourceWidth, sourceHeight, targetRatio);
    const geometry = computeGeometry({
      cols: settings.resolution,
      fontSize: settings.fontSize,
      letterSpacing: settings.letterSpacing,
      lineSpacing: settings.lineSpacing,
      fontFamily: settings.fontFamily,
      sourceRatio: crop.sw / crop.sh,
      maxWidth: request.maxWidth,
      maxHeight: request.maxHeight,
      targetWidth: request.targetWidth,
      targetHeight: request.targetHeight,
    });
    const ramp = parseRamp(settings.charset, DEFAULT_RAMP);
    return { ...geometry, crop, charCount: ramp.chars.length };
  }

  render(source: CanvasImageSource, request: RenderRequest): RenderInfo {
    const { settings } = request;
    const info = this.measure(request);
    const { cols, rows, cellW, cellH, width, height, fontPx, crop } = info;
    const cellCount = cols * rows;

    // --- 1. Downscale straight to the character grid (GPU-accelerated). ---
    resizeCanvas(this.sampleCanvas, cols, rows);
    this.sampleCtx.imageSmoothingEnabled = true;
    this.sampleCtx.imageSmoothingQuality = 'medium';
    this.sampleCtx.clearRect(0, 0, cols, rows);
    try {
      this.sampleCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cols, rows);
    } catch {
      // A not-yet-decodable frame: keep the previous output rather than flashing.
      return this.lastInfo ?? info;
    }

    const imageData = this.sampleCtx.getImageData(0, 0, cols, rows);

    // --- 2. Tone curve + luminance. ---
    if (this.lumaBuffer.length < cellCount) {
      this.lumaBuffer = new Uint8Array(cellCount);
      this.sharpBuffer = new Uint8Array(cellCount);
      this.indexBuffer = new Uint8Array(cellCount);
    }
    const tone = buildToneCurve(settings);
    if (tone.key !== this.toneKey) {
      this.toneLut = tone.lut;
      this.toneKey = tone.key;
    }
    applyToneAndLuma(imageData.data, this.lumaBuffer, cellCount, this.toneLut);

    // --- 3. Optional sharpening on the luma plane. ---
    let luma = this.lumaBuffer;
    if (settings.sharpness > 0) {
      sharpen(this.lumaBuffer, this.sharpBuffer, cols, rows, settings.sharpness);
      luma = this.sharpBuffer;
    }

    // --- 4. Character mapping. ---
    const ramp = parseRamp(settings.charset, DEFAULT_RAMP);
    const flipped = settings.background === 'white';
    if (settings.effects.dither) {
      mapWithDither(luma, this.indexBuffer, cols, rows, ramp.chars.length, flipped);
    } else {
      const lutKey = `${ramp.chars.length}|${flipped}`;
      if (lutKey !== this.rampLutKey) {
        this.rampLut = buildLuminanceLut(ramp.chars.length, flipped);
        this.rampLutKey = lutKey;
      }
      mapWithLut(luma, this.indexBuffer, cellCount, this.rampLut);
    }

    // --- 5. Glyph atlas blit into the mask layer. ---
    const atlasKey = `${ramp.key}|${fontPx.toFixed(2)}|${settings.fontFamily}|${cellW}x${cellH}`;
    if (!this.atlas || atlasKey !== this.atlasKey) {
      this.atlas = buildGlyphAtlas(ramp.chars, fontPx, settings.fontFamily, cellW, cellH);
      this.atlasKey = atlasKey;
    }
    const atlas = this.atlas;

    resizeCanvas(this.glyphCanvas, width, height);
    this.glyphCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.glyphCtx.globalCompositeOperation = 'source-over';
    this.glyphCtx.globalAlpha = 1;
    this.glyphCtx.clearRect(0, 0, width, height);

    const atlasCanvas = atlas.canvas as CanvasImageSource;
    for (let y = 0, i = 0; y < rows; y += 1) {
      const dy = y * cellH;
      for (let x = 0; x < cols; x += 1, i += 1) {
        const index = this.indexBuffer[i];
        const glyph = ramp.chars[index];
        if (!glyph || glyph === ' ') continue;
        this.glyphCtx.drawImage(
          atlasCanvas,
          (index % atlas.columns) * cellW,
          Math.floor(index / atlas.columns) * cellH,
          cellW,
          cellH,
          x * cellW,
          dy,
          cellW,
          cellH,
        );
      }
    }

    // --- 6. Colour, painted through the glyph mask in one composite. ---
    // The adjusted sample buffer doubles as the colour source for 'original'.
    if (settings.colorMode === 'original' && !settings.gradient) {
      this.sampleCtx.putImageData(imageData, 0, 0);
    }
    paintThroughMask(this.glyphCtx, resolveColorFill(settings, this.sampleCanvas), width, height);

    // --- 7. Compose onto the output surface. ---
    resizeCanvas(this.output, width, height);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
    this.ctx.filter = 'none';
    this.ctx.clearRect(0, 0, width, height);

    const background = backgroundColor(settings);
    if (background) {
      this.ctx.fillStyle = background;
      this.ctx.fillRect(0, 0, width, height);
    }
    this.ctx.drawImage(this.glyphCanvas as CanvasImageSource, 0, 0);

    // --- 8. Effects. ---
    const needsScratch = settings.effects.glitch || settings.effects.vhs;
    if (needsScratch) resizeCanvas(this.scratchCanvas, width, height);

    const effectContext: EffectContext = {
      ctx: this.ctx,
      width,
      height,
      settings,
      frameIndex: request.frameIndex,
      glyphCanvas: this.glyphCanvas,
      scratch: this.scratchCanvas,
      accent: accentColorFor(settings),
    };
    if (settings.effects.glow) applyGlow(effectContext);
    applyPostEffects(effectContext);

    this.lastInfo = info;
    this.lastCharset = settings.charset;
    return info;
  }

  /**
   * The last rendered frame as plain text, one line per row.
   * Uses the character indices already computed for the frame, so it always
   * matches exactly what is on screen.
   */
  toText(): string {
    const info = this.lastInfo;
    if (!info) return '';
    const ramp = parseRamp(this.lastCharset, DEFAULT_RAMP);
    const lines: string[] = [];
    for (let y = 0; y < info.rows; y += 1) {
      let line = '';
      for (let x = 0; x < info.cols; x += 1) {
        line += ramp.chars[this.indexBuffer[y * info.cols + x]] ?? ' ';
      }
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }

  /** Releases the intermediate surfaces held by this renderer. */
  dispose(): void {
    resizeCanvas(this.sampleCanvas, 1, 1);
    resizeCanvas(this.glyphCanvas, 1, 1);
    resizeCanvas(this.scratchCanvas, 1, 1);
    this.atlas = null;
    this.atlasKey = '';
    this.lumaBuffer = new Uint8Array(0);
    this.sharpBuffer = new Uint8Array(0);
    this.indexBuffer = new Uint8Array(0);
    this.lastInfo = null;
  }
}
