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
  const safeTarget = Number.isFinite(targetTicks) ? Math.max(1, targetTicks) : 10;
  const raw = duration / safeTarget;
  if (raw < 1) {
    const candidates = [0.1, 0.25, 0.5, 1];
    return candidates.find((candidate) => raw <= candidate) ?? 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

export function buildTicks(duration: number, targetTicks: number): number[] {
  if (!Number.isFinite(duration) || duration < 0) return [];
  const interval = tickInterval(duration, targetTicks);
  const ticks: number[] = [];
  const count = Math.floor((duration + 1e-6) / interval);
  for (let index = 0; index <= count; index += 1) {
    ticks.push(Number((index * interval).toFixed(3)));
  }
  return ticks;
}

export function describeTrim(range: TrimRange): string {
  return `${range.start.toFixed(2)}s to ${range.end.toFixed(2)}s`;
}
