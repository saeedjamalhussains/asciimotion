import { useMemo } from 'react';
import type { UseExport } from '../hooks/useExport';
import type { ExportFormat, ExportSettings, QualityLevel } from '../types';
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
  hasAudio,
  disabled,
}: ExportCardProps) {
  const { state, result, error, support, probing } = exporter;
  const busy =
    state.phase === 'preparing' ||
    state.phase === 'rendering' ||
    state.phase === 'encoding' ||
    state.phase === 'finalizing';

  const activeSupport = support?.[exportSettings.format] ?? null;
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
        <ExportProgress state={state} onCancel={exporter.cancel} />
      </PanelCard>
    );
  }

  // ---------------------------------------------------------------- Result
  if (result && state.phase === 'done') {
    return (
      <PanelCard title="Export" collapsible={false}>
        <div className="flex items-start gap-2">
          <CheckIcon width={16} height={16} className="mt-px shrink-0 text-tint" />
          <div className="min-w-0">
            <p className="truncate">{result.filename}</p>
            <p className="tabular pt-0.5 text-footnote text-muted-foreground">
              {result.width}×{result.height} · {result.durationSeconds.toFixed(1)}s ·{' '}
              {formatBytes(result.blob.size)}
            </p>
          </div>
        </div>

        {result.notes.length > 0 && (
          <ul className="space-y-1">
            {result.notes.map((note) => (
              <li key={note} className="text-footnote text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <Button className="w-full" onClick={exporter.download}>
            <DownloadIcon width={15} height={15} />
            Download {result.filename.split('.').pop()?.toUpperCase()}
          </Button>
          <Button variant="ghost" className="w-full" onClick={exporter.reset}>
            Export Again
          </Button>
        </div>
      </PanelCard>
    );
  }

  // -------------------------------------------------------------- Settings
  return (
    <PanelCard title="Export" collapsible={false}>
      {(error || state.phase === 'cancelled') && (
        <div role="alert" className="flex items-start gap-2">
          {error && <AlertIcon width={15} height={15} className="mt-px shrink-0 text-destructive" />}
          <div className="min-w-0">
            <p className={error ? 'text-destructive' : 'text-fg-dim'}>
              {error ? error.reason : 'Export cancelled.'}
            </p>
            {error && <p className="pt-0.5 text-footnote text-muted-foreground">{error.hint}</p>}
          </div>
        </div>
      )}

      <OptionGroup
        label="Format"
        value={exportSettings.format}
        options={FORMATS.map((format) => {
          const info = support?.[format.value];
          const unavailable = Boolean(support) && !info?.available;
          return { ...format, disabled: unavailable, title: unavailable ? info?.note : undefined };
        })}
        onChange={(format) => onChange({ format })}
      />

      <OptionGroup
        label="Frame rate"
        value={exportSettings.fps}
        options={[24, 30, 60].map((fps) => ({ value: fps, label: `${fps}` }))}
        onChange={(fps) => onChange({ fps })}
      />

      <OptionGroup
        label="Quality"
        value={exportSettings.quality}
        options={QUALITIES}
        onChange={(quality) => onChange({ quality })}
      />

      <OptionGroup
        label="Resolution"
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
            <span className="text-footnote text-muted-foreground">W</span>
            <input
              type="number"
              min={64}
              max={3840}
              step={2}
              value={exportSettings.customWidth}
              aria-label="Custom width in pixels"
              onChange={(event) => onChange({ customWidth: Number(event.target.value) })}
              className="tabular h-7 w-full min-w-0 rounded-md bg-fill px-2 text-footnote text-foreground pointer-coarse:h-10"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-footnote text-muted-foreground">H</span>
            <input
              type="number"
              min={64}
              max={3840}
              step={2}
              value={exportSettings.customHeight}
              aria-label="Custom height in pixels"
              onChange={(event) => onChange({ customHeight: Number(event.target.value) })}
              className="tabular h-7 w-full min-w-0 rounded-md bg-fill px-2 text-footnote text-foreground pointer-coarse:h-10"
            />
          </label>
        </div>
      )}

      {hasAudio && (
        <LabeledSwitch
          label="Original audio"
          checked={exportSettings.includeAudio && audioAvailable}
          disabled={!audioAvailable}
          onChange={(includeAudio) => onChange({ includeAudio })}
        />
      )}

      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((note) => (
            <li key={note} className="text-footnote text-muted-foreground">
              {note}
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
        {probing ? 'Checking Encoders…' : 'Export Video'}
      </Button>
    </PanelCard>
  );
}
