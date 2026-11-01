import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExport } from '../hooks/useExport';
import { useFilePicker } from '../hooks/useFilePicker';
import type { LoadFailure } from '../hooks/useLocalFile';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTimeline } from '../hooks/useTimeline';
import { useVideo } from '../hooks/useVideo';
import { DEFAULT_SETTINGS } from '../state/settings';
import type { EditorSettings, ExportSettings } from '../types';
import type { FrameSource } from '../video/frameSource';
import { cn } from '@/lib/utils';
import { fileFromDataTransfer, SUPPORTED_LABEL } from '../utils/fileHandling';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ControlsSheet, type ControlsSheetHandle } from './ControlsSheet';
import { PreviewStage } from './PreviewStage';
import { Sidebar } from './Sidebar';
import { Timeline } from './Timeline';
import { Button } from '@/components/ui/button';
import { AlertIcon, DownloadIcon, RestoreIcon, UploadIcon } from './ui/Icons';

const RAIL_MIN = 280;
const RAIL_MAX = 640;

interface EditorShellProps {
  source: FrameSource | null;
  file: File | null;
  loading: boolean;
  loadError: LoadFailure | null;
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;
  onDismissError(): void;
  settings: EditorSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<EditorSettings>>;
  exportSettings: ExportSettings;
  onExportSettingsChange: React.Dispatch<React.SetStateAction<ExportSettings>>;
  /** What the main Reset replaced, while it can still be undone. */
  resetFrom: EditorSettings | null;
  onResetFromChange(settings: EditorSettings | null): void;
}

/**
 * The whole application: a full-bleed stage with its chrome floating on top,
 * and the controls in a rail beside it, or in a sheet on small screens.
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
  settings,
  onSettingsChange: setSettings,
  exportSettings: chosenExportSettings,
  onExportSettingsChange: setExportSettings,
  resetFrom,
  onResetFromChange: setResetFrom,
}: EditorShellProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<ControlsSheetHandle>(null);
  const [railWidth, setRailWidth] = useState<number | null>(null);
  const resizeGrab = useRef<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const wide = useMediaQuery('(min-width: 1024px)');

  const modified = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS),
    [settings],
  );

  const clampRail = useCallback((width: number) => {
    const available = bodyRef.current?.clientWidth ?? 1200;
    return Math.round(Math.max(RAIL_MIN, Math.min(width, RAIL_MAX, available * 0.6)));
  }, []);

  const onResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeGrab.current === null || !bodyRef.current) return;
    const right = bodyRef.current.getBoundingClientRect().right;
    setRailWidth(clampRail(right - event.clientX + resizeGrab.current));
  };

  const onResizeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = railRef.current?.clientWidth ?? RAIL_MIN;
    if (event.key === 'ArrowLeft') setRailWidth(clampRail(current + 16));
    else if (event.key === 'ArrowRight') setRailWidth(clampRail(current - 16));
    else if (event.key === 'Home' || event.key === 'Enter') setRailWidth(null);
    else return;
    event.preventDefault();
  };

  // A clip with no audio exports silently, without forgetting the choice for the
  // next clip that has some.
  const hasAudio = source?.info.hasAudio ?? false;
  const exportSettings = useMemo(
    () => ({
      ...chosenExportSettings,
      includeAudio: chosenExportSettings.includeAudio && hasAudio,
    }),
    [chosenExportSettings, hasAudio],
  );

  const timeline = useTimeline(source?.info.duration ?? 0);
  const transport = useVideo(source, timeline.trim);
  const exporter = useExport(source, file, settings, exportSettings, timeline.trim);

  const patch = useCallback(
    (next: Partial<EditorSettings>) => setSettings((current) => ({ ...current, ...next })),
    [setSettings],
  );
  const patchExport = useCallback(
    (next: Partial<ExportSettings>) => setExportSettings((current) => ({ ...current, ...next })),
    [setExportSettings],
  );

  // Tells the stage how much of itself the floating transport covers.
  useEffect(() => {
    const main = mainRef.current;
    const chrome = chromeRef.current;
    if (!main) return;
    if (!chrome) {
      main.style.removeProperty('--chrome-bottom');
      return;
    }
    const observer = new ResizeObserver(() => {
      main.style.setProperty('--chrome-bottom', `${chrome.offsetHeight + 12}px`);
    });
    observer.observe(chrome);
    return () => observer.disconnect();
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

      // A focused control keeps the keys it already answers to.
      if (
        (event.key === ' ' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        target?.closest('button, [role="slider"], [role="radio"], [role="combobox"], [role="separator"]')
      ) {
        return;
      }

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
    sheetRef.current?.expand();
    transport.pause();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      railRef.current?.scrollTo({
        top: railRef.current.scrollHeight,
        behavior: reduced ? 'auto' : 'smooth',
      });
    });
  };

  const setSheetInset = useCallback((pixels: number) => {
    mainRef.current?.style.setProperty('--sheet-inset', `${pixels}px`);
  }, []);

  const pickFile = useCallback(
    (picked: File) => {
      onDismissError();
      onFile(picked);
    },
    [onDismissError, onFile],
  );

  const sidebar = (
    <Sidebar
      source={source}
      loading={loading}
      onFile={pickFile}
      onDemo={onDemo}
      onRemove={onRemove}
      settings={settings}
      onChange={patch}
      exporter={exporter}
      exportSettings={exportSettings}
      onExportChange={patchExport}
    />
  );

  return (
    <div ref={bodyRef} className="flex h-dvh bg-background">
      <main
        ref={mainRef}
        className="am-stage relative h-[calc(100dvh-var(--sheet-inset,0px))] min-w-0 flex-1 overflow-hidden bg-sunken lg:h-full"
      >
        <PreviewStage
          source={source}
          settings={settings}
          emptyState={<EmptyStage loading={loading} onFile={pickFile} onDemo={onDemo} />}
          fullscreenRef={mainRef}
        />

        {/* Fades the artwork out behind the floating title when zoomed in. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[calc(4rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/70 to-transparent"
        />

        <header className="absolute inset-x-0 top-[env(safe-area-inset-top)] z-10 flex h-13 items-center gap-2 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] lg:pr-3">
          <h1 className="text-title font-semibold whitespace-nowrap">ASCII Motion</h1>

          <div className="ml-auto flex items-center gap-1.5">
            {(modified || resetFrom) && (
              <Button
                variant="ghost"
                size="sm"
                className="glass-chip rounded-full"
                onClick={() => {
                  if (modified) {
                    setResetFrom(settings);
                    setSettings(DEFAULT_SETTINGS);
                  } else if (resetFrom) {
                    setSettings(resetFrom);
                    setResetFrom(null);
                  }
                }}
              >
                <RestoreIcon />
                {modified ? 'Reset' : 'Undo Reset'}
              </Button>
            )}
            <Button size="sm" className="rounded-full" onClick={jumpToExport} disabled={!source}>
              <DownloadIcon />
              Export
            </Button>
          </div>
        </header>

        {loadError && (
          <div
            role="alert"
            className="glass animate-materialize absolute inset-x-2 top-[calc(3.25rem+env(safe-area-inset-top))] z-20 mx-auto flex max-w-md items-start gap-2 rounded-xl p-3"
          >
            <AlertIcon width={15} height={15} className="mt-px shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{loadError.reason}</p>
              <p className="pt-0.5 text-footnote text-fg-dim">{loadError.hint}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onDismissError}>
              Dismiss
            </Button>
          </div>
        )}

        {source && (
          <div
            ref={chromeRef}
            className="absolute right-[max(0.5rem,env(safe-area-inset-right))] bottom-2 left-[max(0.5rem,env(safe-area-inset-left))] z-10 lg:right-3 lg:bottom-3 lg:left-3"
          >
            <Timeline source={source} transport={transport} timeline={timeline} />
          </div>
        )}

        {dragging && <DropOverlay />}
      </main>

      {wide ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview and controls"
            aria-valuenow={railWidth ?? undefined}
            tabIndex={0}
            title="Drag to resize · double-click to reset"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const edge = railRef.current?.parentElement?.getBoundingClientRect().left;
              resizeGrab.current = edge === undefined ? 0 : event.clientX - edge;
              setResizing(true);
            }}
            onPointerMove={onResizeMove}
            onPointerUp={() => {
              resizeGrab.current = null;
              setResizing(false);
            }}
            onPointerCancel={() => {
              resizeGrab.current = null;
              setResizing(false);
            }}
            onDoubleClick={() => setRailWidth(null)}
            onKeyDown={onResizeKey}
            className="group relative z-20 -mx-1 w-2 shrink-0 cursor-col-resize touch-none"
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-tint group-focus-visible:bg-tint',
                resizing && 'bg-tint',
              )}
            />
          </div>

          <aside
            aria-label="Controls"
            style={railWidth ? ({ '--rail-w': `${railWidth}px` } as React.CSSProperties) : undefined}
            className="h-full w-[var(--rail-w,21rem)] min-w-0 shrink-0 bg-card xl:w-[var(--rail-w,23rem)]"
          >
            <ScrollArea viewportRef={railRef} className="h-full" type="hover">
              {sidebar}
            </ScrollArea>
          </aside>
        </>
      ) : (
        <ControlsSheet onInset={setSheetInset} viewportRef={railRef} handleRef={sheetRef}>
          {sidebar}
        </ControlsSheet>
      )}
    </div>
  );
}

function EmptyStage({
  loading,
  onFile,
  onDemo,
}: {
  loading: boolean;
  onFile(file: File): void;
  onDemo(): void;
}) {
  const picker = useFilePicker(onFile);

  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-fg-dim">
        <span className="block size-4 animate-spin rounded-full border-2 border-input border-t-tint" />
        Preparing your video…
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      {picker.input}
      <div>
        <h2 className="text-display font-semibold">Drop a video to begin</h2>
        <p className="pt-1 text-muted-foreground">{SUPPORTED_LABEL}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={picker.open}>Choose Video…</Button>
        <Button variant="secondary" onClick={onDemo}>
          Try the Demo
        </Button>
      </div>
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="glass animate-materialize absolute inset-3 z-20 flex items-center justify-center rounded-2xl outline-2 -outline-offset-2 outline-tint outline-dashed">
      <p className="flex items-center gap-2 text-title font-semibold">
        <UploadIcon width={18} height={18} />
        Release to load
      </p>
    </div>
  );
}
