import { useMemo } from 'react';
import type { UseExport } from '../hooks/useExport';
import type { ExportFormat, ExportSettings, QualityLevel, TrimRange } from '../types';
import { cn } from '@/lib/utils';
import { formatBytes } from '../utils/formatTime';
import { ExportProgress } from './ExportProgress';
import { Button } from '@/components/ui/button';
import { PanelCard } from './controls/PanelCard';
import { AlertIcon, CheckIcon, DownloadIcon } from './ui/Icons';
import { OptionGroup } from './controls/OptionGroup';
import { LabeledSwitch } from './controls/LabeledSwitch';

interface ExportCardProps {
  exporter: UseExport;
  exportSettings: ExportSettings;
  onChange(patch: Partial<ExportSettings>): void;
  trim: TrimRange;
  hasAudio: boolean;
  disabled: boolean;
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'webm', label: 'WebM' },
  { value: 'mp4', label: 'MP4' },
  { value: 'gif', label: 'GIF' },
];

const QUALITIES: { value: QualityLevel; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'maximum', label: 'Max' },
];

export function ExportCard({
  exporter,
  exportSettings,
  onChange,
  trim,
  hasAudio,
  disabled,
}: ExportCardProps) {
  const { state, result, error, support, probing, outputSize } = exporter;
  const busy =
    state.phase === 'preparing' ||
    state.phase === 'rendering' ||
    state.phase === 'encoding' ||
    state.phase === 'finalizing';

  const activeSupport = support?.[exportSettings.format] ?? null;
  const duration = Math.max(0, trim.end - trim.start);
  const frames = Math.max(1, Math.round(duration * exportSettings.fps));
  const audioAvailable = hasAudio && (activeSupport?.canIncludeAudio ?? false);

  const notes = useMemo(() => {
    const list: string[] = [];
    if (activeSupport?.note) list.push(activeSupport.note);
    if (hasAudio && activeSupport && !activeSupport.canIncludeAudio) {
      list.push('Your browser has no encoder for this format’s audio, so the export is silent.');
    }
    return list;
  }, [activeSupport, hasAudio]);

  // ------------------------------------------------------------- In flight
  if (busy) {
    return (
      <PanelCard title="Export" collapsible={false}>
        <ExportProgress state={state} onCancel={exporter.cancel} compact />
      </PanelCard>
    );
  }

  // ---------------------------------------------------------------- Result
  if (result && state.phase === 'done') {
    return (
      <PanelCard title="Export" collapsible={false}>
        <div className="flex items-start gap-2.5 rounded-[8px] border border-primary/35 bg-primary-subtle/40 p-2.5">
          <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-mono text-[11.5px] text-foreground">{result.filename}</p>
            <p className="pt-0.5 font-mono tabular text-[10.5px] text-muted-foreground">
              {result.width}×{result.height} · {result.durationSeconds.toFixed(1)}s ·{' '}
              {formatBytes(result.blob.size)}
            </p>
          </div>
        </div>

        {result.notes.length > 0 && (
          <ul className="space-y-1">
            {result.notes.map((note) => (
              <li key={note} className="text-[11.5px] leading-relaxed text-muted-foreground">
                — {note}
              </li>
            ))}
          </ul>
        )}

        <Button className="w-full" onClick={exporter.download}>
          <DownloadIcon width={15} height={15} />
          Download {result.filename.split('.').pop()?.toUpperCase()}
        </Button>
        <button
          type="button"
          onClick={exporter.reset}
          className="w-full text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Export again
        </button>
      </PanelCard>
    );
  }

  // -------------------------------------------------------------- Settings
  return (
    <PanelCard title="Export" meta={probing ? undefined : `${frames} frames`} collapsible={false}>
      {(error || state.phase === 'cancelled') && (
        <div
          role="alert"
          className={cn(
            'flex items-start gap-2 rounded-[8px] border px-2.5 py-2',
            error ? 'border-destructive/35 bg-destructive/10' : 'border-border bg-background',
          )}
        >
          {error && <AlertIcon width={14} height={14} className="mt-0.5 shrink-0 text-destructive" />}
          <div className="min-w-0">
            <p className={cn('text-[12px]', error ? 'text-destructive' : 'text-fg-dim')}>
              {error ? error.reason : 'Export cancelled.'}
            </p>
            {error && <p className="pt-0.5 text-[11.5px] leading-snug text-muted-foreground">{error.hint}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {FORMATS.map((format) => {
          const info = support?.[format.value];
          const unavailable = Boolean(support) && !info?.available;
          const active = exportSettings.format === format.value;
          return (
            <button
              key={format.value}
              type="button"
              aria-pressed={active}
              disabled={unavailable}
              title={unavailable ? info?.note : undefined}
              onClick={() => onChange({ format: format.value })}
              className={cn(
                'rounded-[7px] border py-1.5 font-mono text-[11.5px] transition-colors',
                active
                  ? 'border-primary/45 bg-primary-subtle/60 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-input hover:text-foreground',
                unavailable && 'cursor-not-allowed opacity-35 hover:border-border hover:text-muted-foreground',
              )}
            >
              {format.label}
            </button>
          );
        })}
      </div>

      <OptionGroup
        label="Frame rate"
        size="sm"
        value={exportSettings.fps}
        options={[24, 30, 60].map((fps) => ({ value: fps, label: `${fps}` }))}
        onChange={(fps) => onChange({ fps })}
      />

      <OptionGroup
        label="Quality"
        size="sm"
        value={exportSettings.quality}
        options={QUALITIES}
        onChange={(quality) => onChange({ quality })}
      />

      <OptionGroup
        label="Resolution"
        size="sm"
        columns={4}
        value={exportSettings.resolutionPreset}
        options={[
          { value: 'current', label: 'Auto' },
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' },
          { value: 'custom', label: 'Custom' },
        ]}
        onChange={(resolutionPreset) =>
          onChange({ resolutionPreset: resolutionPreset as ExportSettings['resolutionPreset'] })
        }
      />

      {exportSettings.resolutionPreset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-faint">W</span>
            <input
              type="number"
              min={64}
              max={3840}
              step={2}
              value={exportSettings.customWidth}
              aria-label="Custom width in pixels"
              onChange={(event) => onChange({ customWidth: Number(event.target.value) })}
              className="h-8 w-full rounded-[6px] border border-border bg-background px-2 font-mono text-[11.5px] text-foreground"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-faint">H</span>
            <input
              type="number"
              min={64}
              max={3840}
              step={2}
              value={exportSettings.customHeight}
              aria-label="Custom height in pixels"
              onChange={(event) => onChange({ customHeight: Number(event.target.value) })}
              className="h-8 w-full rounded-[6px] border border-border bg-background px-2 font-mono text-[11.5px] text-foreground"
            />
          </label>
        </div>
      )}

      <LabeledSwitch
        label="Original audio"
        checked={exportSettings.includeAudio && audioAvailable}
        disabled={!audioAvailable}
        onChange={(includeAudio) => onChange({ includeAudio })}
      />

      <dl className="space-y-1 rounded-[8px] border border-border bg-background px-2.5 py-2 font-mono text-[10.5px]">
        <Row label="output" value={outputSize ? `${outputSize.width}×${outputSize.height}` : '—'} />
        <Row label="range" value={`${duration.toFixed(2)}s · ${frames}f`} />
        <Row
          label="encoder"
          value={
            probing
              ? 'checking…'
              : activeSupport?.strategy === 'webcodecs'
                ? 'WebCodecs'
                : activeSupport?.strategy === 'mediarecorder'
                  ? 'MediaRecorder'
                  : activeSupport?.strategy === 'gif'
                    ? 'GIF worker'
                    : 'unavailable'
          }
        />
      </dl>

      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((note) => (
            <li key={note} className="text-[11px] leading-relaxed text-faint">
              — {note}
            </li>
          ))}
        </ul>
      )}

      <Button
        className="w-full"
        disabled={disabled || probing || !activeSupport?.available}
        onClick={() => void exporter.start(exportSettings)}
      >
        <DownloadIcon width={15} height={15} />
        {probing ? 'Checking encoders…' : 'Export video'}
      </Button>
    </PanelCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="truncate tabular text-muted-foreground">{value}</dd>
    </div>
  );
}
