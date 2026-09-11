import type { TrimRange } from '../types';
import { formatTimePrecise } from '../utils/formatTime';
import { cn } from '@/lib/utils';
import { ScissorsIcon } from './ui/Icons';

interface TrimControlsProps {
  trim: TrimRange;
  duration: number;
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
  duration,
  trimmed,
  getTime,
  onSetStart,
  onSetEnd,
  onReset,
}: TrimControlsProps) {
  const selected = Math.max(0, trim.end - trim.start);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <ScissorsIcon width={14} height={14} />
        <span className="eyebrow">Trim</span>
      </span>

      <button
        type="button"
        onClick={() => onSetStart(getTime())}
        className="rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-[11px] text-fg-dim transition-colors hover:border-input hover:text-foreground"
        title="Set the start of the range to the playhead"
      >
        in <span className="tabular text-foreground">{formatTimePrecise(trim.start)}</span>
      </button>

      <button
        type="button"
        onClick={() => onSetEnd(getTime())}
        className="rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-[11px] text-fg-dim transition-colors hover:border-input hover:text-foreground"
        title="Set the end of the range to the playhead"
      >
        out <span className="tabular text-foreground">{formatTimePrecise(trim.end)}</span>
      </button>

      <span
        className={cn(
          'font-mono tabular text-[11px]',
          trimmed ? 'text-primary' : 'text-faint',
        )}
      >
        {selected.toFixed(2)}s selected
      </span>

      {trimmed && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-[6px] px-1.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Use full clip ({duration.toFixed(1)}s)
        </button>
      )}
    </div>
  );
}
