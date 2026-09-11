import type { EditorSettings } from '../types';
import {
  createCanvas,
  get2d,
  supportsCanvasFilter,
  type AnyCanvas,
  type Ctx2D,
} from './canvasRenderer';

/**
 * Post-processing pass.
 *
 * Every effect is driven purely by the integer frame index, so a preview frame
 * and the exported frame at the same position are pixel-identical. Effects
 * that would otherwise strobe (noise, glitch) advance on a slower deterministic
 * clock unless `flicker` is explicitly enabled.
 */

export interface EffectContext {
  ctx: Ctx2D;
  width: number;
  height: number;
  settings: EditorSettings;
  frameIndex: number;
  glyphCanvas: AnyCanvas;
  scratch: AnyCanvas;
  accent: string;
}

/** Small, fast, fully deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseTile: AnyCanvas | null = null;
function getNoiseTile(): AnyCanvas {
  if (noiseTile) return noiseTile;
  const size = 128;
  const canvas = createCanvas(size, size);
  const ctx = get2d(canvas);
  const image = ctx.createImageData(size, size);
  const random = mulberry32(0x9e3779b9);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.round(random() * 255);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  noiseTile = canvas;
  return canvas;
}

function copyToScratch(ec: EffectContext): Ctx2D {
  const scratchCtx = get2d(ec.scratch);
  scratchCtx.clearRect(0, 0, ec.width, ec.height);
  scratchCtx.drawImage(ec.ctx.canvas as CanvasImageSource, 0, 0);
  return scratchCtx;
}

/** Soft phosphor bloom, drawn from the glyph mask so it never blooms the background. */
export function applyGlow(ec: EffectContext): void {
  const { ctx, width, height, glyphCanvas } = ec;
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.006));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (supportsCanvasFilter()) {
    ctx.filter = `blur(${radius}px)`;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(glyphCanvas as CanvasImageSource, 0, 0);
    ctx.filter = `blur(${radius * 2.6}px)`;
    ctx.globalAlpha = 0.32;
    ctx.drawImage(glyphCanvas as CanvasImageSource, 0, 0);
    ctx.filter = 'none';
  } else {
    // Shadow-based fallback for engines without canvas filters.
    ctx.globalAlpha = 0.42;
    ctx.shadowColor = ec.accent;
    ctx.shadowBlur = radius * 3;
    ctx.drawImage(glyphCanvas as CanvasImageSource, 0, 0);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

export function applyScanlines(ec: EffectContext): void {
  const { ctx, width, height } = ec;
  const period = Math.max(2, Math.round(height / 260) * 2);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  for (let y = 0; y < height; y += period) {
    ctx.fillRect(0, y, width, Math.max(1, period / 2));
  }
  ctx.restore();
}

/** Phosphor triad mask, corner vignette and a slow rolling refresh band. */
export function applyCrt(ec: EffectContext): void {
  const { ctx, width, height, frameIndex } = ec;
  ctx.save();

  ctx.globalCompositeOperation = 'multiply';
  const stripe = Math.max(3, Math.round(width / 640) * 3);
  const cell = Math.max(1, Math.round(stripe / 3));
  for (let x = 0; x < width; x += stripe) {
    ctx.fillStyle = 'rgba(255, 90, 90, 0.10)';
    ctx.fillRect(x, 0, cell, height);
    ctx.fillStyle = 'rgba(90, 255, 140, 0.10)';
    ctx.fillRect(x + cell, 0, cell, height);
    ctx.fillStyle = 'rgba(110, 150, 255, 0.10)';
    ctx.fillRect(x + cell * 2, 0, stripe - cell * 2, height);
  }

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.28,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(255,255,255,1)');
  vignette.addColorStop(0.72, 'rgba(150,150,150,1)');
  vignette.addColorStop(1, 'rgba(40,40,40,1)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Rolling refresh band — one slow sweep every ~4 seconds at 30fps.
  const bandHeight = Math.max(8, height * 0.09);
  const y = ((frameIndex % 120) / 120) * (height + bandHeight) - bandHeight;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const band = ctx.createLinearGradient(0, y, 0, y + bandHeight);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(255,255,255,0.045)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, y, width, bandHeight);
  ctx.restore();
}

/** Chroma bleed plus a drifting tracking distortion. */
export function applyVhs(ec: EffectContext): void {
  const { ctx, width, height, frameIndex } = ec;
  copyToScratch(ec);
  const random = mulberry32(frameIndex * 2654435761);
  const shift = Math.max(1, width * 0.0025);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ff2f4f';
  ctx.drawImage(ec.scratch as CanvasImageSource, -shift, 0);
  ctx.globalAlpha = 0.18;
  ctx.drawImage(ec.scratch as CanvasImageSource, shift, 0);
  ctx.restore();

  // Two or three tracking bands per frame, positions seeded by frame index.
  const bands = 2 + Math.floor(random() * 2);
  ctx.save();
  for (let i = 0; i < bands; i += 1) {
    const bandY = Math.floor(random() * height);
    const bandH = Math.max(2, Math.floor(random() * height * 0.035));
    const offset = (random() - 0.5) * width * 0.05;
    ctx.drawImage(
      ec.scratch as CanvasImageSource,
      0,
      bandY,
      width,
      bandH,
      offset,
      bandY,
      width,
      bandH,
    );
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, bandY, width, bandH);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** Sliced RGB displacement, gated so it fires in bursts rather than constantly. */
export function applyGlitch(ec: EffectContext): void {
  const { ctx, width, height, frameIndex } = ec;
  const gate = mulberry32(Math.floor(frameIndex / 6) * 97 + 13)();
  if (gate > 0.55) return;

  copyToScratch(ec);
  const random = mulberry32(frameIndex * 40503 + 7);
  const slices = 3 + Math.floor(random() * 6);

  ctx.save();
  for (let i = 0; i < slices; i += 1) {
    const y = Math.floor(random() * height);
    const h = Math.max(3, Math.floor(random() * height * 0.08));
    const dx = (random() - 0.5) * width * 0.12;
    ctx.clearRect(0, y, width, h);
    ctx.drawImage(ec.scratch as CanvasImageSource, 0, y, width, h, dx, y, width, h);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(ec.scratch as CanvasImageSource, width * 0.004, 0);
  ctx.restore();
}

/** Falling highlights, one per column band, at seeded speeds. */
export function applyMatrix(ec: EffectContext): void {
  const { ctx, width, height, frameIndex } = ec;
  const columns = Math.max(8, Math.round(width / 26));
  const colWidth = width / columns;
  const random = mulberry32(0x5bf03635);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < columns; i += 1) {
    const speed = 0.4 + random() * 1.9;
    const phase = random();
    const trail = height * (0.16 + random() * 0.3);
    const head = (((frameIndex * speed) / 90 + phase) % 1.35) * (height + trail) - trail;
    const gradient = ctx.createLinearGradient(0, head - trail, 0, head);
    gradient.addColorStop(0, 'rgba(80, 255, 160, 0)');
    gradient.addColorStop(0.75, 'rgba(80, 255, 160, 0.10)');
    gradient.addColorStop(1, 'rgba(190, 255, 220, 0.34)');
    ctx.fillStyle = gradient;
    ctx.fillRect(i * colWidth, head - trail, colWidth, trail);
  }
  ctx.restore();
}

/** Grain, advanced every third frame so it reads as texture rather than strobe. */
export function applyNoise(ec: EffectContext): void {
  const { ctx, width, height, frameIndex, settings } = ec;
  const tile = getNoiseTile();
  const step = settings.effects.flicker ? frameIndex : Math.floor(frameIndex / 3);
  const random = mulberry32(step * 374761393 + 5);
  const ox = Math.floor(random() * 128);
  const oy = Math.floor(random() * 128);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  const pattern = ctx.createPattern(tile as CanvasImageSource, 'repeat');
  if (pattern) {
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + 128, height + 128);
  }
  ctx.restore();
}

/** Unstable brightness — the only intentionally strobing effect. */
export function applyFlicker(ec: EffectContext): void {
  const { ctx, width, height, frameIndex } = ec;
  const random = mulberry32(frameIndex * 1103515245 + 12345);
  const jitter = random();
  const wave = Math.sin(frameIndex * 0.7) * 0.5 + 0.5;
  const amount = (jitter * 0.6 + wave * 0.4 - 0.5) * 0.22;

  ctx.save();
  if (amount >= 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.14, amount)})`;
  } else {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(255,255,255,${1 + Math.max(-0.22, amount)})`;
  }
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Runs the enabled effects in a fixed order so results are reproducible.
 * `glow` is applied by the renderer while the glyph mask is still available.
 */
export function applyPostEffects(ec: EffectContext): void {
  const fx = ec.settings.effects;
  if (fx.matrix) applyMatrix(ec);
  if (fx.glitch) applyGlitch(ec);
  if (fx.vhs) applyVhs(ec);
  if (fx.scanlines) applyScanlines(ec);
  if (fx.crt) applyCrt(ec);
  if (fx.noise) applyNoise(ec);
  if (fx.flicker) applyFlicker(ec);
}

export function anyPostEffectEnabled(settings: EditorSettings): boolean {
  const fx = settings.effects;
  return fx.matrix || fx.glitch || fx.vhs || fx.scanlines || fx.crt || fx.noise || fx.flicker;
}
