import type { ExportProgressState } from '../types';
import { formatEta } from '../utils/formatTime';
import { Button } from '@/components/ui/button';

interface ExportProgressProps {
  state: ExportProgressState;
  onCancel(): void;
}

export function ExportProgress({ state, onCancel }: ExportProgressProps) {
  const percent = Math.round(Math.max(0, Math.min(1, state.progress)) * 100);
  const eta = formatEta(state.etaSeconds);

  return (
    <div className="space-y-2.5" role="status" aria-live="polite">
      <p className="label-micro text-muted-foreground">{state.message || 'Rendering ASCII video…'}</p>

      <div
        className="am-blocks h-2 w-full overflow-hidden bg-input"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Export progress"
      >
        <div
          className="h-full bg-tint transition-[width] duration-200 ease-[steps(8,end)]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <span className="tabular text-display font-semibold text-tint">{String(percent).padStart(3, '0')}%</span>
        {eta && <span className="text-footnote text-muted-foreground">{eta}</span>}
      </div>

      <Button variant="secondary" onClick={onCancel} className="w-full">
        Cancel Export
      </Button>
    </div>
  );
}
