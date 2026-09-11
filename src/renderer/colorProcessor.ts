import { TERMINAL_COLORS } from '../state/settings';
import type { EditorSettings } from '../types';
import type { AnyCanvas, Ctx2D } from './canvasRenderer';

export type ColorFill =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string }
  | { kind: 'source'; canvas: AnyCanvas };

/**
 * Chooses how the glyph layer gets its colour. All modes end up as a single
 * `source-in` paint over the white glyph mask.
 */
export function resolveColorFill(settings: EditorSettings, sampleCanvas: AnyCanvas): ColorFill {
  if (settings.gradient) {
    return { kind: 'gradient', from: settings.gradientFrom, to: settings.gradientTo };
  }
  switch (settings.colorMode) {
    case 'original':
      return { kind: 'source', canvas: sampleCanvas };
    case 'custom':
      return { kind: 'solid', color: settings.customColor };
    default:
      return { kind: 'solid', color: TERMINAL_COLORS[settings.colorMode] ?? '#ffffff' };
  }
}

/**
 * Paints `fill` through the existing alpha of `ctx` (the glyph mask).
 * The caller must have drawn the mask first.
 */
export function paintThroughMask(
  ctx: Ctx2D,
  fill: ColorFill,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-in';
  if (fill.kind === 'source') {
    // Nearest-neighbour upscale: each sampled cell colours exactly one glyph.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fill.canvas as CanvasImageSource, 0, 0, width, height);
  } else if (fill.kind === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, fill.from);
    gradient.addColorStop(1, fill.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = fill.color;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** Solid page colour behind the glyphs, or nothing when exporting alpha. */
export function backgroundColor(settings: EditorSettings): string | null {
  if (settings.background === 'white') return '#ffffff';
  if (settings.background === 'transparent') return null;
  return '#000000';
}

/** Representative accent colour, used for UI chrome and the glow pass. */
export function accentColorFor(settings: EditorSettings): string {
  if (settings.gradient) return settings.gradientFrom;
  if (settings.colorMode === 'custom') return settings.customColor;
  if (settings.colorMode === 'original') return '#ffffff';
  return TERMINAL_COLORS[settings.colorMode] ?? '#ffffff';
}
