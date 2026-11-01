import { useFilePicker } from '../hooks/useFilePicker';
import type { FrameSource } from '../video/frameSource';
import { formatBytes, formatTime } from '../utils/formatTime';
import { Button } from '@/components/ui/button';
import { PanelCard } from './controls/PanelCard';

interface SourceCardProps {
  source: FrameSource | null;
  loading: boolean;
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;
}

/** The clip currently loaded, and the controls to change it. */
export function SourceCard({ source, loading, onFile, onDemo, onRemove }: SourceCardProps) {
  const picker = useFilePicker(onFile);

  return (
    <PanelCard title="Source" collapsible={false}>
      {picker.input}

      {source && (
        <div className="min-w-0">
          <p className="truncate" title={source.info.name}>
            {source.info.name}
          </p>
          <p className="tabular pt-0.5 text-footnote text-muted-foreground">
            {source.info.width}×{source.info.height} · {formatTime(source.info.duration)}
            {source.info.size != null ? ` · ${formatBytes(source.info.size)}` : ''}
          </p>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" onClick={picker.open} disabled={loading}>
          {loading ? 'Reading…' : source ? 'Replace…' : 'Choose Video…'}
        </Button>
        {source?.kind !== 'demo' && (
          <Button variant="ghost" size="sm" onClick={onDemo} disabled={loading}>
            Demo Clip
          </Button>
        )}
        {source && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="ml-auto">
            Remove
          </Button>
        )}
      </div>
    </PanelCard>
  );
}
