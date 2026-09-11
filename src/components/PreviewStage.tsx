import { useCallback, useRef, useState } from 'react';
import { useAsciiRenderer, type ZoomMode } from '../hooks/useAsciiRenderer';
import type { AsciiRenderer } from '../renderer/asciiRenderer';
import type { EditorSettings } from '../types';
import type { FrameSource } from '../video/frameSource';
import { cn } from '@/lib/utils';
import { IconButton } from './controls/IconButton';
import { CheckIcon, CopyIcon, ExpandIcon, FitIcon, MinusIcon, PlusIcon } from './ui/Icons';

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

interface PreviewStageProps {
  source: FrameSource | null;
  settings: EditorSettings;
  /** Rendered over the stage — used for the drag-and-drop overlay. */
  overlay?: React.ReactNode;
  emptyState?: React.ReactNode;
}

/**
 * The main stage: a titled surface holding the ASCII raster, with zoom and
 * frame actions in the corners.
 */
export function PreviewStage({ source, settings, overlay, emptyState }: PreviewStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AsciiRenderer | null>(null);
  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [copied, setCopied] = useState(false);

  const stats = useAsciiRenderer(canvasRef, stageRef, source, settings, zoom, rendererRef);
  const percent = zoom === 'fit' ? (stats?.fitPercent ?? 100) : Math.round(zoom * 100);

  const stepZoom = useCallback(
    (direction: 1 | -1) => {
      const current = percent / 100;
      const next =
        direction > 0
          ? (ZOOM_STEPS.find((step) => step > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
          : ([...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? ZOOM_STEPS[0]);
      setZoom(next);
    },
    [percent],
  );

  const copyText = useCallback(async () => {
    const text = rendererRef.current?.toText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard permission denied — leave the button unchanged. */
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void card.requestFullscreen?.().catch(() => undefined);
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-background"
    >
      <header className="flex shrink-0 items-center gap-3 px-3 py-2.5">
        <span className="panel-heading">Preview</span>
        {stats && (
          <span className="hidden font-mono tabular text-[10.5px] text-faint sm:inline">
            {stats.cols}×{stats.rows} · {stats.width}×{stats.height}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            label={copied ? 'Frame copied' : 'Copy this frame as text'}
            size="sm"
            onClick={copyText}
            disabled={!source}
          >
            {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
          </IconButton>
          <IconButton label="Toggle fullscreen" size="sm" onClick={toggleFullscreen}>
            <ExpandIcon width={14} height={14} />
          </IconButton>
        </div>
      </header>

      <div
        ref={stageRef}
        className={cn(
          'relative flex min-h-0 flex-1 items-center justify-center border-t border-border p-3',
          // Panning space once the raster is larger than the stage.
          zoom === 'fit' ? 'overflow-hidden' : 'overflow-auto',
          settings.background === 'transparent' ? 'checkerboard' : 'bg-sunken',
        )}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={source ? `ASCII preview of ${source.info.name}` : 'ASCII preview'}
          className={cn(
            'block shrink-0',
            // Containment belongs to fit mode only — clamping a zoomed-in
            // canvas would silently cap the zoom at the stage size.
            zoom === 'fit' && 'max-h-full max-w-full',
            !source && 'hidden',
          )}
        />
        {!source && emptyState}
        {overlay}
      </div>

      {/* Zoom controls, anchored to the stage corners. */}
      {source && (
        <>
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((current) => (current === 'fit' ? 1 : 'fit'))}
              title={zoom === 'fit' ? 'Zoom to 100%' : 'Fit to stage'}
              className="pointer-events-auto rounded-[6px] border border-border bg-background/80 px-2 py-1 font-mono tabular text-[10.5px] text-fg-dim backdrop-blur-sm transition-colors hover:text-foreground"
            >
              {percent}%
            </button>
            {zoom !== 'fit' && (
              <button
                type="button"
                onClick={() => setZoom('fit')}
                title="Fit to stage"
                aria-label="Fit to stage"
                className="pointer-events-auto rounded-[6px] border border-border bg-background/80 p-1.5 text-fg-dim backdrop-blur-sm transition-colors hover:text-foreground"
              >
                <FitIcon width={13} height={13} />
              </button>
            )}
          </div>

          <div className="pointer-events-auto absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-[6px] border border-border bg-background/80 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => stepZoom(1)}
              aria-label="Zoom in"
              title="Zoom in"
              className="p-1.5 text-fg-dim transition-colors hover:bg-muted hover:text-foreground"
            >
              <PlusIcon width={13} height={13} />
            </button>
            <button
              type="button"
              onClick={() => stepZoom(-1)}
              aria-label="Zoom out"
              title="Zoom out"
              className="border-t border-border p-1.5 text-fg-dim transition-colors hover:bg-muted hover:text-foreground"
            >
              <MinusIcon width={13} height={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
