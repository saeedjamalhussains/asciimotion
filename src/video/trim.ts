import type { TrimRange } from '../types';

/** The shortest clip we allow the user to select. */
export const MIN_TRIM_DURATION = 0.1;

export function clampTrim(range: TrimRange, duration: number): TrimRange {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const start = Math.max(0, Math.min(range.start, Math.max(0, safeDuration - MIN_TRIM_DURATION)));
  const end = Math.min(safeDuration, Math.max(range.end, start + MIN_TRIM_DURATION));
  return { start, end };
}

export function trimDuration(range: TrimRange): number {
  return Math.max(0, range.end - range.start);
}

export function isTrimmed(range: TrimRange, duration: number): boolean {
  return range.start > 0.001 || range.end < duration - 0.001;
}

/** Keeps playback inside the selected region. */
export function clampPlayhead(time: number, range: TrimRange): number {
  if (time < range.start) return range.start;
  if (time > range.end) return range.end;
  return time;
}
