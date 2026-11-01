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
}

/**
 * The stage: the ASCII raster on black, filling everything behind the floating
 * chrome. Padding keeps the fitted raster clear of the chrome, while a zoomed
 * one scrolls underneath it.
 */
export function PreviewStage({ source, settings, emptyState, fullscreenRef }: PreviewStageProps) {
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

  const toggleFullscreen = useCallback(() => {
    const target = fullscreenRef.current;
    if (!target) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void target.requestFullscreen?.().catch(() => undefined);
  }, [fullscreenRef]);

  return (
    <>
      <div
        ref={stageRef}
        className={cn(
          // Below lg the zoom pill gets its own band, as the artwork has no room to spare.
          'absolute inset-0 flex items-center-safe justify-center-safe px-3 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(var(--chrome-bottom,0px)+3.25rem)] lg:pb-[calc(var(--chrome-bottom,0px)+0.75rem)]',
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

      {source && (
        <div className="glass-chip absolute right-[max(0.5rem,env(safe-area-inset-right))] bottom-[calc(var(--chrome-bottom,0px)+0.25rem)] z-10 flex items-center rounded-full p-0.5 lg:right-3">
          <IconButton label="Zoom out" size="md" className="rounded-full" onClick={() => stepZoom(-1)}>
            <MinusIcon width={14} height={14} />
          </IconButton>
          <button
            type="button"
            onClick={() => setZoom((current) => (current === 'fit' ? 1 : 'fit'))}
            title={zoom === 'fit' ? 'Zoom to 100%' : 'Fit to stage'}
            className="press tabular h-7 w-10 text-center text-footnote text-foreground pointer-coarse:h-10"
          >
            {zoom === 'fit' ? 'Fit' : `${percent}%`}
          </button>
          <IconButton label="Zoom in" size="md" className="rounded-full" onClick={() => stepZoom(1)}>
            <PlusIcon width={14} height={14} />
          </IconButton>
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/15" />
          <IconButton
            label={copied ? 'Frame copied' : 'Copy this frame as text'}
            size="md"
            className="rounded-full"
            onClick={copyText}
          >
            {copied ? (
              <CheckIcon width={14} height={14} className="text-tint" />
            ) : (
              <CopyIcon width={14} height={14} />
            )}
          </IconButton>
          {/* iPhone Safari has no element fullscreen, so offer nothing that cannot work. */}
          {document.fullscreenEnabled && (
            <IconButton
              label="Toggle fullscreen"
              size="md"
              className="rounded-full"
              onClick={toggleFullscreen}
            >
              <ExpandIcon width={14} height={14} />
            </IconButton>
          )}
        </div>
      )}
    </>
  );
}
