import { useCallback, useEffect, useRef, useState } from 'react';
import { useExport } from '../hooks/useExport';
import type { LoadFailure } from '../hooks/useLocalFile';
import { useTimeline } from '../hooks/useTimeline';
import { useVideo } from '../hooks/useVideo';
import { DEFAULT_EXPORT_SETTINGS, DEFAULT_SETTINGS } from '../state/settings';
import type { EditorSettings, ExportSettings } from '../types';
import type { FrameSource } from '../video/frameSource';
import { cn } from '@/lib/utils';
import { fileFromDataTransfer } from '../utils/fileHandling';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PreviewStage } from './PreviewStage';
import { Sidebar } from './Sidebar';
import { Timeline } from './Timeline';
import { Button } from '@/components/ui/button';
import { IconButton } from './controls/IconButton';
import { DownloadIcon, RestoreIcon, SlidersIcon, UploadIcon } from './ui/Icons';

interface EditorShellProps {
  source: FrameSource | null;
  file: File | null;
  loading: boolean;
  loadError: LoadFailure | null;
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;
  onDismissError(): void;
}

/**
 * The whole application: a header of global actions, a stage carrying the
 * preview and transport, and a rail of control cards.
 */
export function EditorShell({
  source,
  file,
  loading,
  loadError,
  onFile,
  onDemo,
  onRemove,
  onDismissError,
}: EditorShellProps) {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [dragging, setDragging] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const dragDepth = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);

  const timeline = useTimeline(source?.info.duration ?? 0);
  const transport = useVideo(source, timeline.trim);
  const exporter = useExport(source, file, settings, exportSettings, timeline.trim);

  const patch = useCallback(
    (next: Partial<EditorSettings>) => setSettings((current) => ({ ...current, ...next })),
    [],
  );
  const patchExport = useCallback(
    (next: Partial<ExportSettings>) => setExportSettings((current) => ({ ...current, ...next })),
    [],
  );

  // A clip with no audio must not offer to keep it.
  useEffect(() => {
    if (!source?.info.hasAudio) {
      setExportSettings((current) => ({ ...current, includeAudio: false }));
    }
  }, [source]);

  // Drag and drop anywhere in the window.
  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      dragDepth.current = 0;
      setDragging(false);
      if (!event.dataTransfer) return;
      event.preventDefault();
      const dropped = fileFromDataTransfer(event.dataTransfer);
      if (dropped) {
        onDismissError();
        onFile(dropped);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFile, onDismissError]);

  // Keyboard shortcuts, ignored while typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || !source) return;

      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          transport.toggle();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          transport.step(event.shiftKey ? -1 : -1 / 30);
          break;
        case 'ArrowRight':
          event.preventDefault();
          transport.step(event.shiftKey ? 1 : 1 / 30);
          break;
        case 'i':
          event.preventDefault();
          timeline.setStart(transport.getTime());
          break;
        case 'o':
          event.preventDefault();
          timeline.setEnd(transport.getTime());
          break;
        case 'm':
          event.preventDefault();
          transport.setMuted(!transport.muted);
          break;
        case 'l':
          event.preventDefault();
          transport.setLoop(!transport.loop);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [transport, timeline, source]);

  const jumpToExport = () => {
    setRailOpen(true);
    transport.pause();
    window.requestAnimationFrame(() => {
      railRef.current?.scrollTo({ top: railRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  return (
    <div className="flex min-h-full flex-col gap-2 bg-background p-2 sm:p-3 lg:h-full lg:overflow-hidden">
      {/* ------------------------------------------------------------ Header */}
      <header className="flex h-11 shrink-0 items-center gap-2 px-1">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-input bg-background font-mono text-[11px] leading-none font-bold text-primary"
          >
            &gt;_
          </span>
          <span className="font-mono text-[12px] font-semibold tracking-[0.14em] whitespace-nowrap uppercase">
            ASCII<span className="text-primary"> Motion</span>
          </span>
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="flex items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RestoreIcon width={13} height={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            type="button"
            aria-pressed={settings.invert}
            onClick={() => patch({ invert: !settings.invert })}
            className={cn(
              'flex items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[12px] transition-colors',
              settings.invert
                ? 'bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full border border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]"
            />
            <span className="hidden sm:inline">Invert</span>
          </button>

          <span className="lg:hidden">
            <IconButton label="Show controls" onClick={() => setRailOpen((v) => !v)} active={railOpen}>
              <SlidersIcon width={16} height={16} />
            </IconButton>
          </span>

          <Button size="sm" onClick={jumpToExport} disabled={!source}>
            <DownloadIcon width={14} height={14} />
            Export
          </Button>
        </div>
      </header>

      {/* -------------------------------------------------------------- Body */}
        {/* Below lg the page flows naturally; from lg it becomes a fixed-height
          two-column workspace. */}
      <div className="flex min-h-0 flex-col gap-2 lg:flex-1 lg:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-h-[46vh] flex-col sm:min-h-[52vh] lg:min-h-0 lg:flex-1">
            <PreviewStage
              source={source}
              settings={settings}
              emptyState={<EmptyStage loading={loading} />}
              overlay={dragging ? <DropOverlay /> : null}
            />
          </div>
          {source && <Timeline source={source} transport={transport} timeline={timeline} />}
        </main>

        <aside
          aria-label="Controls"
          className={cn(
            'w-full shrink-0 lg:w-[336px] xl:w-[368px]',
            !railOpen && 'hidden lg:block',
          )}
        >
          <ScrollArea viewportRef={railRef} className="lg:h-full" type="hover">
          <Sidebar
            source={source}
            loading={loading}
            loadError={loadError}
            onFile={onFile}
            onDemo={onDemo}
            onRemove={onRemove}
            onDismissError={onDismissError}
            settings={settings}
            onChange={patch}
            exporter={exporter}
            exportSettings={exportSettings}
            onExportChange={patchExport}
            trim={timeline.trim}
          />
          </ScrollArea>
        </aside>
      </div>

    </div>
  );
}

function EmptyStage({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <pre className="font-mono text-[12px] leading-tight text-faint select-none">
        {'  .:-=+*#%@  \n  @%#*+=-:.  '}
      </pre>
      <p className="text-[14px] text-fg-dim">
        {loading ? 'Preparing your video…' : 'Drop a video to begin'}
      </p>
      {!loading && (
        <p className="text-[12px] text-faint">or use the Source panel to browse or load the demo</p>
      )}
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[8px] border-2 border-dashed border-primary bg-primary-subtle/40 backdrop-blur-[2px]">
      <p className="flex items-center gap-2 text-[14px] font-medium text-primary">
        <UploadIcon width={17} height={17} />
        Release to load
      </p>
    </div>
  );
}
