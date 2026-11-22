import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Film, X } from 'lucide-react';
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
import { formatTime } from '../utils/formatTime';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { IconButton } from './controls/IconButton';
import { PreviewStage, toggleFullscreen } from './PreviewStage';
import { Timeline } from './Timeline';
import { countActiveEffects, ToolPanel, type ToolPanelProps } from './ToolPanel';
import { DESKTOP_TOOLS, MOBILE_TOOLS, TOOL_META, type ToolId } from './tools';
import { AlertIcon, DownloadIcon, ExpandIcon, RestoreIcon, UploadIcon } from './ui/Icons';
import { LogoMark } from './ui/Logo';

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
 * The whole application, in one of two layouts sharing the same tools:
 *
 * - Desktop: a top bar, the stage with its timeline docked beneath, and an
 *   inspector showing one tool at a time beside a vertical tool strip.
 * - Phone: a mobile video editor's layout — preview, transport and timeline,
 *   then a bottom toolbar whose tools open in a drawer above it.
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
  const mainRef = useRef<HTMLElement>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  /** The desktop inspector always shows a tool. */
  const [tool, setTool] = useState<ToolId>('characters');
  /** The phone drawer is closed until a tool is picked. */
  const [drawer, setDrawer] = useState<ToolId | null>(null);

  const modified = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS),
    [settings],
  );

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

  const pickFile = useCallback(
    (picked: File) => {
      onDismissError();
      onFile(picked);
    },
    [onDismissError, onFile],
  );

  const openExport = () => {
    transport.pause();
    if (wide) setTool('export');
    else setDrawer('export');
  };

  const toggleReset = () => {
    if (modified) {
      setResetFrom(settings);
      setSettings(DEFAULT_SETTINGS);
    } else if (resetFrom) {
      setSettings(resetFrom);
      setResetFrom(null);
    }
  };
  const canReset = modified || Boolean(resetFrom);
  const resetLabel = modified ? 'Reset all' : 'Undo reset';

  const panelProps: Omit<ToolPanelProps, 'tool'> = {
    source,
    loading,
    onFile: pickFile,
    onDemo,
    onRemove,
    settings,
    onChange: patch,
    exporter,
    exportSettings,
    onExportChange: patchExport,
    timeline,
    transport,
  };

  const stage = (
    <>
      <PreviewStage
        source={source}
        settings={settings}
        showControls={wide}
        emptyState={<EmptyStage loading={loading} onFile={pickFile} onDemo={onDemo} />}
        fullscreenRef={mainRef}
      />
      {dragging && <DropOverlay />}
    </>
  );

  const errorBanner = loadError && (
    <div
      role="alert"
      className="glass animate-materialize absolute inset-x-2 top-14 z-30 mx-auto flex max-w-md items-start gap-2 rounded-md p-3"
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
  );

  // ------------------------------------------------------------- Desktop
  if (wide) {
    return (
      <div className="relative flex h-dvh flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
          <Brand />
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <MediaBar
            source={source}
            loading={loading}
            onFile={pickFile}
            onDemo={onDemo}
            onRemove={onRemove}
          />
          <div className="ml-auto flex items-center gap-1.5">
            {canReset && (
              <Button variant="ghost" size="sm" onClick={toggleReset}>
                <RestoreIcon />
                {resetLabel}
              </Button>
            )}
            <Button size="sm" onClick={openExport} disabled={!source}>
              <DownloadIcon />
              Export
            </Button>
          </div>
        </header>

        {errorBanner}

        <div className="flex min-h-0 flex-1">
          <main ref={mainRef} className="flex min-w-0 flex-1 flex-col bg-sunken">
            <div className="relative min-h-0 flex-1">{stage}</div>
            {source && <Timeline source={source} transport={transport} timeline={timeline} />}
          </main>

          <nav
            aria-label="Tools"
            className="flex w-[4.5rem] shrink-0 flex-col gap-0.5 border-l border-border bg-background py-1.5"
          >
            {DESKTOP_TOOLS.map((id) => (
              <ToolButton
                key={id}
                id={id}
                active={tool === id}
                badge={id === 'effects' ? countActiveEffects(settings) : 0}
                onClick={() => setTool(id)}
                indicator="left"
                className="mx-1.5 h-14"
              />
            ))}
          </nav>

          <aside aria-label="Inspector" className="w-80 shrink-0 border-l border-border bg-card">
            <ScrollArea className="h-full" type="hover">
              <ToolPanel tool={tool} {...panelProps} />
            </ScrollArea>
          </aside>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- Phone
  return (
    <div className="relative flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        <div className="flex h-12 min-w-0 flex-1 items-center">
          <Brand />
        </div>
        {canReset && (
          <IconButton label={resetLabel} onClick={toggleReset}>
            <RestoreIcon />
          </IconButton>
        )}
        <Button size="sm" onClick={openExport} disabled={!source}>
          <DownloadIcon />
          Export
        </Button>
      </header>

      {errorBanner}

      <main ref={mainRef} className="relative min-h-0 flex-1 bg-sunken">
        {stage}
      </main>

      {source && (
        <div className="shrink-0 border-t border-border bg-background">
          <Timeline
            source={source}
            transport={transport}
            timeline={timeline}
            variant="compact"
            trailing={
              document.fullscreenEnabled && (
                <IconButton
                  label="Toggle fullscreen"
                  onClick={() => toggleFullscreen(mainRef.current)}
                >
                  <ExpandIcon />
                </IconButton>
              )
            }
          />
        </div>
      )}

      {drawer && (
        <div className="max-h-[46dvh] shrink-0 overflow-y-auto overscroll-contain border-t border-hairline bg-card">
          <ToolPanel
            tool={drawer}
            {...panelProps}
            actions={
              <Button variant="secondary" size="sm" onClick={() => setDrawer(null)}>
                <Check />
                Done
              </Button>
            }
          />
        </div>
      )}

      <nav
        aria-label="Tools"
        className="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex overflow-x-auto overscroll-x-contain px-1 py-1 [scrollbar-width:none]">
          {MOBILE_TOOLS.map((id) => (
            <ToolButton
              key={id}
              id={id}
              active={drawer === id}
              badge={id === 'effects' ? countActiveEffects(settings) : 0}
              onClick={() => setDrawer((current) => (current === id ? null : id))}
              indicator="top"
              className="h-14 min-w-16 flex-1"
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <h1
      aria-label="ASCII Motion"
      className="flex items-center gap-2.5 text-footnote tracking-[0.2em] whitespace-nowrap uppercase"
    >
      <LogoMark className="size-[18px] shrink-0 text-tint" />
      <span aria-hidden="true">
        <span className="font-bold text-foreground">ASCII</span>
        <span className="pl-[0.45em] font-normal text-muted-foreground">Motion</span>
      </span>
    </h1>
  );
}

/** An icon over a short label; the tool strip's and the phone toolbar's button. */
function ToolButton({
  id,
  active,
  badge,
  onClick,
  indicator,
  className,
}: {
  id: ToolId;
  active: boolean;
  badge: number;
  onClick(): void;
  /** Which edge carries the active bar: the strip's outer edge, or the toolbar's top. */
  indicator: 'left' | 'top';
  className?: string;
}) {
  const { label, icon: Icon } = TOOL_META[id];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'press relative flex shrink-0 flex-col items-center justify-center gap-1 rounded-md label-micro',
        active ? 'bg-primary/10 text-tint' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bg-tint',
            indicator === 'left' ? 'inset-y-3 -left-1.5 w-0.5' : 'inset-x-4 top-0 h-0.5',
          )}
        />
      )}
      <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      {label}
      {badge > 0 && (
        <span className="tabular absolute top-1.5 right-2 min-w-3.5 rounded-sm bg-primary px-0.5 text-center text-[9px] leading-[14px] text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

/** The loaded clip and the controls to change it, in the desktop top bar. */
function MediaBar({
  source,
  loading,
  onFile,
  onDemo,
  onRemove,
}: {
  source: FrameSource | null;
  loading: boolean;
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;
}) {
  const picker = useFilePicker(onFile);
  return (
    <div className="flex min-w-0 items-center gap-2">
      {picker.input}
      {source ? (
        <>
          <Film aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <span className="max-w-56 truncate" title={source.info.name}>
            {source.info.name}
          </span>
          <span className="tabular hidden text-footnote whitespace-nowrap text-muted-foreground xl:inline">
            {source.info.width}×{source.info.height} · {formatTime(source.info.duration)}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">No clip loaded</span>
      )}
      <Button variant="secondary" size="sm" onClick={picker.open} disabled={loading}>
        {loading ? 'Reading…' : source ? 'Replace…' : 'Open…'}
      </Button>
      {!source?.builtIn && (
        <Button variant="ghost" size="sm" onClick={onDemo} disabled={loading}>
          Demo clip
        </Button>
      )}
      {source && (
        <IconButton label="Remove clip" onClick={onRemove}>
          <X />
        </IconButton>
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
        <span className="block size-3 animate-spin border border-tint" />
        Preparing your video…
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      {picker.input}
      <LogoMark className="size-10 text-tint" />
      <div>
        <h2 className="text-display font-semibold">Drop a video to begin</h2>
        <p className="pt-2 label-micro text-muted-foreground">{SUPPORTED_LABEL}</p>
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
    <div className="glass animate-materialize absolute inset-3 z-20 flex items-center justify-center rounded-md outline-1 -outline-offset-8 outline-tint outline-dashed">
      <p className="flex items-center gap-2 text-title font-semibold tracking-[0.2em] text-tint uppercase">
        <UploadIcon width={18} height={18} />
        Release to load
      </p>
    </div>
  );
}
