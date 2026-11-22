import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TrimRange } from '../types';
import { clampTrim, MIN_TRIM_DURATION, trimDuration } from '../video/trim';

export interface TimelineState {
  trim: TrimRange;
  duration: number;
  selectedDuration: number;
  trimmed: boolean;
  setStart(value: number): void;
  setEnd(value: number): void;
  setTrim(range: TrimRange): void;
  reset(): void;
}

export function useTimeline(duration: number): TimelineState {
  const [trim, setTrimState] = useState<TrimRange>({ start: 0, end: duration });

  // A new clip resets the selection to the whole timeline.
  useEffect(() => {
    setTrimState({ start: 0, end: duration });
  }, [duration]);

  const setTrim = useCallback(
    (range: TrimRange) => setTrimState(clampTrim(range, duration)),
    [duration],
  );

  const setStart = useCallback(
    (value: number) => {
      setTrimState((current) =>
        clampTrim(
          { start: Math.min(value, current.end - MIN_TRIM_DURATION), end: current.end },
          duration,
        ),
      );
    },
    [duration],
  );

  const setEnd = useCallback(
    (value: number) => {
      setTrimState((current) =>
        clampTrim(
          { start: current.start, end: Math.max(value, current.start + MIN_TRIM_DURATION) },
          duration,
        ),
      );
    },
    [duration],
  );

  const reset = useCallback(() => setTrimState({ start: 0, end: duration }), [duration]);

  return useMemo(
    () => ({
      trim,
      duration,
      selectedDuration: trimDuration(trim),
      trimmed: trim.start > 0.001 || trim.end < duration - 0.001,
      setStart,
      setEnd,
      setTrim,
      reset,
    }),
    [trim, duration, setStart, setEnd, setTrim, reset],
  );
}
