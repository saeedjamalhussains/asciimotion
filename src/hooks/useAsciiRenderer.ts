import { useEffect, useRef, useState } from 'react';
import { AsciiRenderer, type RenderInfo } from '../renderer/asciiRenderer';
import { startFrameLoop } from '../utils/frameLoop';
import type { EditorSettings } from '../types';
import type { FrameSource } from '../video/frameSource';

export interface PreviewStats {
  cols: number;
  rows: number;
  width: number;
  height: number;
  charCount: number;
  fps: number;
  /**
   * Scale the raster is shown at in fit mode, as a percentage. Reported
   * regardless of the active zoom so the control can switch back to it
   * without waiting for the next measurement.
   */
  fitPercent: number;
}

/** `'fit'` scales the raster to the stage; a number is raster-pixels-per-CSS-pixel. */
export type ZoomMode = 'fit' | number;

/** Upper bound on the preview raster, independent of display density. */
const MAX_PREVIEW_DIMENSION = 2048;

/**
 * Below this the stage is mid-layout rather than genuinely tiny. Accepting such
 * a measurement would render a degenerate raster and latch it in.
 */
const MIN_USABLE_BOX = 32;

/**
 * Drives the live ASCII preview.
 *
 * The loop is intentionally outside React: settings live in a ref, the canvas
 * is mutated directly, and component state is only touched when the reported
 * grid statistics actually change. A playing video therefore causes zero React
 * renders per frame.
 */
export function useAsciiRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  source: FrameSource | null,
  settings: EditorSettings,
  zoom: ZoomMode = 'fit',
  rendererRef?: React.MutableRefObject<AsciiRenderer | null>,
): PreviewStats | null {
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const dirtyRef = useRef(true);
  const boxRef = useRef({ width: 960, height: 540 });

  // Any settings or zoom change invalidates the current frame.
  useEffect(() => {
    dirtyRef.current = true;
  }, [settings, zoom]);

  // Track the available preview area without re-rendering on every resize.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width >= MIN_USABLE_BOX && height >= MIN_USABLE_BOX) {
        boxRef.current = { width, height };
      }
      // Re-measure on the next render even if this reading was rejected.
      dirtyRef.current = true;
    });
    observer.observe(container);
    const rect = container.getBoundingClientRect();
    if (rect.width >= MIN_USABLE_BOX && rect.height >= MIN_USABLE_BOX) {
      boxRef.current = { width: rect.width, height: rect.height };
    }
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) {
      setStats(null);
      return;
    }

    const renderer = new AsciiRenderer(canvas);
    if (rendererRef) rendererRef.current = renderer;
    let disposed = false;
    let lastToken = -1;
    let lastTime = -1;
    let lastStatsKey = '';
    let frameIndex = 0;
    let frameTimes: number[] = [];
    let lastStatsPush = 0;

    const draw = (now: number) => {
      if (disposed) return;

      const currentSettings = settingsRef.current;
      const token = source.frameToken;
      const time = source.currentTime;
      const invalidated = dirtyRef.current;
      const needsRender = invalidated || token !== lastToken || time !== lastTime;
      if (!needsRender) return;

      dirtyRef.current = false;
      lastToken = token;
      lastTime = time;

      // Settings, zoom and resize changes all re-measure the stage. Taking the
      // size here rather than trusting the observer's cached value means a
      // reading captured mid-layout can never latch the raster to a bad size.
      if (invalidated) {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          if (rect.width >= MIN_USABLE_BOX && rect.height >= MIN_USABLE_BOX) {
            boxRef.current = { width: rect.width, height: rect.height };
          }
        }
      }

      const image = source.image;
      if (!image) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = boxRef.current;
      const maxWidth = Math.min(MAX_PREVIEW_DIMENSION, Math.max(160, box.width * dpr));
      const maxHeight = Math.min(MAX_PREVIEW_DIMENSION, Math.max(90, box.height * dpr));

      // The frame index is derived from media time so preview and export agree.
      frameIndex = Math.max(0, Math.round(time * 30));

      let info: RenderInfo;
      try {
        info = renderer.render(image, {
          settings: currentSettings,
          sourceWidth: source.info.width,
          sourceHeight: source.info.height,
          frameIndex,
          maxWidth,
          maxHeight,
        });
      } catch {
        return;
      }

      // On-screen size.
      //
      // In fit mode nothing is set inline: the canvas carries `max-w-full
      // max-h-full`, so the browser contains it inside the stage from its
      // intrinsic size, exactly as it would an image. That keeps the visual
      // fit correct even when a measurement is stale or taken mid-layout —
      // `box` then only influences raster sharpness, never the layout.
      const currentZoom = zoomRef.current;
      if (currentZoom === 'fit') {
        if (canvas.style.width) {
          canvas.style.width = '';
          canvas.style.height = '';
        }
      } else {
        canvas.style.width = `${Math.max(1, Math.round(info.width * currentZoom))}px`;
        canvas.style.height = `${Math.max(1, Math.round(info.height * currentZoom))}px`;
      }

      frameTimes.push(now);
      if (frameTimes.length > 30) frameTimes = frameTimes.slice(-30);

      if (now - lastStatsPush > 400) {
        lastStatsPush = now;
        const span =
          frameTimes.length > 4 ? (frameTimes[frameTimes.length - 1] - frameTimes[0]) / 1000 : 0;
        const fps = span > 0 ? Math.round((frameTimes.length - 1) / span) : 0;
        // Prefer the laid-out width; fall back to the arithmetic that
        // `max-width/height: 100%` performs (it only ever shrinks) so the
        // read-out is still sensible before the first layout has settled.
        const measured = zoomRef.current === 'fit' ? canvas.clientWidth : 0;
        const fitScale =
          measured > 0
            ? measured / info.width
            : Math.min(1, box.width / info.width, box.height / info.height);
        const fitPercent = Math.max(1, Math.round(fitScale * 100));
        const key = `${info.cols}x${info.rows}|${info.width}x${info.height}|${info.charCount}|${fps}|${fitPercent}`;
        if (key !== lastStatsKey) {
          lastStatsKey = key;
          setStats({
            cols: info.cols,
            rows: info.rows,
            width: info.width,
            height: info.height,
            charCount: info.charCount,
            fps,
            fitPercent,
          });
        }
      }
    };

    const loop = startFrameLoop(draw);
    const onVisible = () => {
      dirtyRef.current = true;
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      loop.stop();
      document.removeEventListener('visibilitychange', onVisible);
      if (rendererRef && rendererRef.current === renderer) rendererRef.current = null;
      renderer.dispose();
    };
  }, [canvasRef, containerRef, source, rendererRef]);

  return stats;
}
