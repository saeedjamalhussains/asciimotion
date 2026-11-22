import { useCallback, useRef, useState } from 'react';
import { useAsciiRenderer, type ZoomMode } from '../hooks/useAsciiRenderer';
import type { AsciiRenderer } from '../renderer/asciiRenderer';
import type { EditorSettings } from '../types';
import type { FrameSource } from '../video/frameSource';
import { cn } from '@/lib/utils';
import { IconButton } from './controls/IconButton';
import { CheckIcon, CopyIcon, ExpandIcon, MinusIcon, PlusIcon } from './ui/Icons';

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

interface PreviewStageProps {
  source: FrameSource | null;
  settings: EditorSettings;
  emptyState?: React.ReactNode;
  /** The element that goes fullscreen, so the transport comes along. */
  fullscreenRef: React.RefObject<HTMLElement | null>;
  /** The zoom, copy and fullscreen bar. Phones leave it out: the preview is fitted. */
  showControls?: boolean;
}

export function toggleFullscreen(target: HTMLElement | null): void {
  if (!target) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void target.requestFullscreen?.().catch(() => undefined);
}

/**
 * The stage: the ASCII raster centred in its own box. A zoomed raster scrolls
 * inside it; the view controls sit in its bottom-right corner.
 */
export function PreviewStage({
  source,
  settings,
  emptyState,
  fullscreenRef,
  showControls = true,
}: PreviewStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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

  return (
    <>
      <div
        ref={stageRef}
        className={cn(
          'absolute inset-0 flex items-center-safe justify-center-safe p-3',
          showControls && 'p-6 pb-14',
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
      </div>

      {source && showControls && (
        <div className="glass-chip absolute right-3 bottom-3 z-10 flex items-center rounded-md p-0.5">
          {stats && (
            <span className="tabular px-2 label-micro text-muted-foreground">
              {stats.cols}×{stats.rows}
            </span>
          )}
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-hairline" />
          <IconButton label="Zoom out" size="md" onClick={() => stepZoom(-1)}>
            <MinusIcon width={14} height={14} />
          </IconButton>
          <button
            type="button"
            onClick={() => setZoom((current) => (current === 'fit' ? 1 : 'fit'))}
            title={zoom === 'fit' ? 'Zoom to 100%' : 'Fit to stage'}
            className="press tabular h-7 w-12 text-center label-micro text-foreground hover:text-tint"
          >
            {zoom === 'fit' ? 'Fit' : `${percent}%`}
          </button>
          <IconButton label="Zoom in" size="md" onClick={() => stepZoom(1)}>
            <PlusIcon width={14} height={14} />
          </IconButton>
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-hairline" />
          <IconButton
            label={copied ? 'Frame copied' : 'Copy this frame as text'}
            size="md"
            onClick={copyText}
          >
            {copied ? (
              <CheckIcon width={14} height={14} className="text-tint" />
            ) : (
              <CopyIcon width={14} height={14} />
            )}
          </IconButton>
          {document.fullscreenEnabled && (
            <IconButton
              label="Toggle fullscreen"
              size="md"
              onClick={() => toggleFullscreen(fullscreenRef.current)}
            >
              <ExpandIcon width={14} height={14} />
            </IconButton>
          )}
        </div>
      )}
    </>
  );
}
