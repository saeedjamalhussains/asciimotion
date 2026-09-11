import type { TrimRange } from '../types';

/** Maps between timeline pixels and media time. */
export function timeToRatio(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(1, time / duration));
}

export function ratioToTime(ratio: number, duration: number): number {
  return Math.max(0, Math.min(duration, ratio * duration));
}

export function ratioFromPointer(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

/** Nice tick spacing for the ruler, in seconds. */
export function tickInterval(duration: number, targetTicks: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const raw = duration / Math.max(1, targetTicks);
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const candidate of candidates) {
    if (raw <= candidate) return candidate;
  }
  return 900;
}

export function buildTicks(duration: number, targetTicks: number): number[] {
  const interval = tickInterval(duration, targetTicks);
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += interval) ticks.push(Number(t.toFixed(3)));
  return ticks;
}

export function describeTrim(range: TrimRange): string {
  return `${range.start.toFixed(2)}s to ${range.end.toFixed(2)}s`;
}
