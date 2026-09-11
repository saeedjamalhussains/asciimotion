import { useRef } from 'react';
import type { LoadFailure } from '../hooks/useLocalFile';
import type { FrameSource } from '../video/frameSource';
import { ACCEPT_ATTRIBUTE, SUPPORTED_LABEL } from '../utils/fileHandling';
import { formatBytes, formatTime } from '../utils/formatTime';
import { PanelCard } from './controls/PanelCard';
import { AlertIcon, SparkIcon, TrashIcon, UploadIcon } from './ui/Icons';

interface SourceCardProps {
  source: FrameSource | null;
  loading: boolean;
  error: LoadFailure | null;
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;
  onDismissError(): void;
}

/** The clip currently loaded, and the controls to change it. */
export function SourceCard({
  source,
  loading,
  error,
  onFile,
  onDemo,
  onRemove,
  onDismissError,
}: SourceCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => inputRef.current?.click();

  return (
    <PanelCard title="Source" collapsible={false}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onDismissError();
            onFile(file);
          }
          event.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-[8px] border border-dashed border-input bg-background px-3 py-2.5 text-left transition-colors hover:border-input hover:bg-muted disabled:opacity-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground">
          {loading ? (
            <span className="block h-3.5 w-3.5 rounded-full border-2 border-input border-t-primary animate-spin-slow" />
          ) : (
            <UploadIcon width={15} height={15} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] text-foreground">
            {loading ? 'Reading video…' : source ? 'Replace video' : 'Upload video'}
          </span>
          <span className="block truncate font-mono text-[10px] tracking-wide text-faint uppercase">
            Drop or browse · {SUPPORTED_LABEL}
          </span>
        </span>
      </button>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[8px] border border-destructive/35 bg-destructive/10 px-2.5 py-2"
        >
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-destructive">{error.reason}</p>
            <p className="pt-0.5 text-[11.5px] leading-snug text-muted-foreground">{error.hint}</p>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss"
            className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {source ? (
        <div className="rounded-[8px] border border-border bg-background px-2.5 py-2">
          <p className="truncate text-[12px] text-fg-dim" title={source.info.name}>
            {source.info.name}
          </p>
          <p className="pt-0.5 font-mono tabular text-[10.5px] text-faint">
            {source.info.width}×{source.info.height} · {formatTime(source.info.duration)}
            {source.info.size != null ? ` · ${formatBytes(source.info.size)}` : ''}
          </p>
          <div className="flex items-center gap-1 pt-2">
            <button
              type="button"
              onClick={onDemo}
              className="rounded-[5px] px-1.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SparkIcon width={12} height={12} className="mr-1 inline align-[-2px]" />
              Demo clip
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto rounded-[5px] px-1.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <TrashIcon width={12} height={12} className="mr-1 inline align-[-2px]" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDemo}
          className="w-full rounded-[8px] border border-border bg-background px-2.5 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SparkIcon width={13} height={13} className="mr-1.5 inline align-[-2px]" />
          Load the demo clip
        </button>
      )}
    </PanelCard>
  );
}
