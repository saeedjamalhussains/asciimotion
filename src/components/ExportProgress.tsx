import type { ExportProgressState } from '../types';
import { cn } from '@/lib/utils';
import { formatEta } from '../utils/formatTime';
import { Button } from '@/components/ui/button';

interface ExportProgressProps {
  state: ExportProgressState;
  onCancel(): void;
  /** Tighter type and spacing for the control rail. */
  compact?: boolean;
}

const BAR_CELLS = 24;
const BAR_CELLS_COMPACT = 18;

/** ASCII progress bar, in keeping with the rest of the product. */
function asciiBar(progress: number, cells: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * cells);
  return '█'.repeat(filled) + '░'.repeat(cells - filled);
}

export function ExportProgress({ state, onCancel, compact = false }: ExportProgressProps) {
  const percent = Math.round(Math.max(0, Math.min(1, state.progress)) * 100);
  const eta = formatEta(state.etaSeconds);

  return (
    <div className={compact ? '' : 'py-2'} role="status" aria-live="polite">
      <p className={compact ? 'text-[12px] text-fg-dim' : 'text-[14px] text-foreground'}>
        {state.message || 'Rendering ASCII video…'}
      </p>

      <div className={compact ? 'pt-2.5' : 'pt-4'}>
        <div
          className={cn(
            'overflow-x-auto font-mono leading-none tracking-[0.06em] text-primary hide-scrollbar',
            compact ? 'text-[11px]' : 'text-[15px]',
          )}
          aria-hidden="true"
        >
          {asciiBar(state.progress, compact ? BAR_CELLS_COMPACT : BAR_CELLS)}
        </div>
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-accent"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Export progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className={cn('flex items-baseline justify-between gap-4', compact ? 'pt-2' : 'pt-3')}>
        <span
          className={cn(
            'font-mono tabular leading-none text-foreground',
            compact ? 'text-[15px]' : 'text-[22px]',
          )}
        >
          {percent}%
        </span>
        <span className="font-mono tabular text-[11px] text-muted-foreground">
          {state.renderedSeconds.toFixed(1)} / {state.totalSeconds.toFixed(1)}s
        </span>
      </div>

      {eta && <p className="pt-1.5 text-[11.5px] text-faint">{eta}</p>}

      <div className={compact ? 'pt-3' : 'pt-6'}>
        <Button variant="secondary" size={compact ? 'sm' : 'default'} onClick={onCancel} className="w-full">
          Cancel export
        </Button>
      </div>
    </div>
  );
}
