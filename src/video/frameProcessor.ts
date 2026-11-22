import type { FrameSource } from './frameSource';
import { seekVideo } from './videoLoader';

/**
 * Deterministic frame stepping for export.
 *
 * Rather than recording the preview in real time (which drops frames on a busy
 * machine), the exporter seeks to each timestamp and waits for the decoder.
 * The result is frame-accurate and independent of how fast the device is.
 */
export interface FrameWalkerOptions {
  source: FrameSource;
  start: number;
  end: number;
  fps: number;
}

export class FrameWalker {
  readonly frameCount: number;
  readonly fps: number;
  private readonly source: FrameSource;
  private readonly start: number;

  constructor({ source, start, end, fps }: FrameWalkerOptions) {
    this.source = source;
    this.start = start;
    this.fps = fps;
    const duration = Math.max(0, end - start);
    this.frameCount = Math.max(1, Math.round(duration * fps));
  }

  timeFor(index: number): number {
    return this.start + index / this.fps;
  }

  /** Positions the source on frame `index` and resolves once it is drawable. */
  async seekTo(index: number): Promise<number> {
    const time = this.timeFor(index);
    if (this.source.element) {
      await seekVideo(this.source.element, time);
    } else {
      await this.source.seek(time);
    }
    return time;
  }
}

/**
 * Waits one animation frame, with a timer fallback.
 *
 * Browsers suspend `requestAnimationFrame` entirely while a tab is hidden, so
 * a bare rAF await would deadlock an export the moment the user switches away.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(done);
    setTimeout(done, 100);
  });
}

/**
 * Yields to the event loop between encoded frames.
 *
 * `setTimeout(…, 0)` is clamped to roughly one second in background tabs, which
 * would slow a long export to a crawl as soon as the user switches tab. A
 * `MessageChannel` message is not subject to that clamp, so the export keeps
 * running at full speed in the background while still letting the UI breathe.
 */
const yieldQueue: (() => void)[] = [];
let yieldChannel: MessageChannel | null = null;

function ensureYieldChannel(): MessageChannel {
  if (yieldChannel) return yieldChannel;
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    yieldQueue.shift()?.();
  };
  channel.port1.start?.();
  yieldChannel = channel;
  return channel;
}

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    yieldQueue.push(resolve);
    ensureYieldChannel().port2.postMessage(null);
  });
}
