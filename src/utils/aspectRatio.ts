import { ASPECT_PRESETS } from '../state/settings';
import type { AspectRatioId } from '../types';

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function ratioFor(id: AspectRatioId, sourceRatio: number): number {
  const preset = ASPECT_PRESETS.find((p) => p.id === id);
  return preset?.ratio ?? sourceRatio;
}

/**
 * Centre-crops the source rectangle so it matches the requested aspect ratio.
 * This keeps the subject framed rather than stretching the footage.
 */
export function cropForAspect(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio: number,
): CropRect {
  if (!sourceWidth || !sourceHeight || !Number.isFinite(targetRatio) || targetRatio <= 0) {
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
  }
  const sourceRatio = sourceWidth / sourceHeight;
  if (Math.abs(sourceRatio - targetRatio) < 0.0005) {
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
  }
  if (sourceRatio > targetRatio) {
    const sw = Math.round(sourceHeight * targetRatio);
    return { sx: Math.round((sourceWidth - sw) / 2), sy: 0, sw, sh: sourceHeight };
  }
  const sh = Math.round(sourceWidth / targetRatio);
  return { sx: 0, sy: Math.round((sourceHeight - sh) / 2), sw: sourceWidth, sh };
}

/** Fits `ratio` inside a box, returning integer pixel dimensions. */
export function fitInside(boxW: number, boxH: number, ratio: number): { w: number; h: number } {
  if (!Number.isFinite(ratio) || ratio <= 0) return { w: boxW, h: boxH };
  let w = boxW;
  let h = Math.round(w / ratio);
  if (h > boxH) {
    h = boxH;
    w = Math.round(h * ratio);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
