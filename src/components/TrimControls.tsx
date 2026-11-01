import type { TrimRange } from '../types';
import { formatTimePrecise } from '../utils/formatTime';
import { Button } from '@/components/ui/button';

interface TrimControlsProps {
  trim: TrimRange;
  trimmed: boolean;
  getTime(): number;
  onSetStart(value: number): void;
  onSetEnd(value: number): void;
  onReset(): void;
}

/**
 * Numeric read-out for the selected range, with set-in / set-out buttons that
 * take their value from the current playhead position.
 */
export function TrimControls({
  trim,
  trimmed,
  getTime,
  onSetStart,
  onSetEnd,
  onReset,
}: TrimControlsProps) {
  const selected = Math.max(0, trim.end - trim.start);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSetStart(getTime())}
        title="Set the start of the range to the playhead"
      >
        <span className="text-fg-dim">In</span>
        <span className="tabular">{formatTimePrecise(trim.start)}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSetEnd(getTime())}
        title="Set the end of the range to the playhead"
      >
        <span className="text-fg-dim">Out</span>
        <span className="tabular">{formatTimePrecise(trim.end)}</span>
      </Button>

      {trimmed && (
        <Button variant="ghost" size="sm" onClick={onReset} title="Use the full clip">
          <span className="tabular text-trim">{selected.toFixed(2)}s</span>
          Clear
        </Button>
      )}
    </div>
  );
}
