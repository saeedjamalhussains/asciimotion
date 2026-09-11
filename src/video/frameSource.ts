import type { MediaInfo } from '../types';

export type SourceEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'seeked'
  | 'timeupdate'
  | 'ratechange'
  | 'volumechange'
  | 'error';

/**
 * A seekable, drawable media source.
 *
 * Three implementations share this shape — a decoded `<video>` file, an
 * animated GIF decoded with `ImageDecoder`, and the procedural demo clip.
 * The renderer, timeline and exporter only ever talk to this interface.
 */
export interface FrameSource {
  readonly kind: 'video' | 'gif' | 'demo';
  readonly info: MediaInfo;
  readonly duration: number;
  /** What the renderer draws. Valid after `ready`. */
  readonly image: CanvasImageSource | null;
  readonly paused: boolean;
  currentTime: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  /** Bumps whenever new pixels are available. */
  readonly frameToken: number;
  /** Underlying element, when one exists (used for audio capture). */
  readonly element: HTMLVideoElement | null;

  play(): Promise<void>;
  pause(): void;
  /** Seeks and resolves once the frame at `time` is drawable. */
  seek(time: number): Promise<void>;
  on(event: SourceEvent, handler: (payload?: unknown) => void): () => void;
  dispose(): void;
}

type Handler = (payload?: unknown) => void;

export class Emitter {
  private handlers = new Map<SourceEvent, Set<Handler>>();

  on(event: SourceEvent, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  emit(event: SourceEvent, payload?: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) handler(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Shared wall-clock playback for sources that have no native transport
 * (the GIF decoder and the procedural demo).
 */
export abstract class ClockSource {
  protected emitter = new Emitter();
  protected startedAt = 0;
  protected offset = 0;
  protected running = false;
  protected rate = 1;
  protected rafId: number | null = null;
  protected token = 0;

  abstract readonly duration: number;

  get frameToken(): number {
    return this.token;
  }

  get paused(): boolean {
    return !this.running;
  }

  get playbackRate(): number {
    return this.rate;
  }

  set playbackRate(value: number) {
    const now = this.now();
    this.offset = this.clampTime(now);
    this.startedAt = performance.now();
    this.rate = value;
    this.emitter.emit('ratechange');
  }

  get currentTime(): number {
    return this.clampTime(this.now());
  }

  set currentTime(value: number) {
    this.offset = this.clampTime(value);
    this.startedAt = performance.now();
    void this.renderAt(this.offset);
    this.emitter.emit('timeupdate');
    this.emitter.emit('seeked');
  }

  protected now(): number {
    if (!this.running) return this.offset;
    return this.offset + ((performance.now() - this.startedAt) / 1000) * this.rate;
  }

  protected clampTime(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(value, this.duration);
  }

  async play(): Promise<void> {
    if (this.running) return;
    if (this.currentTime >= this.duration - 0.001) this.offset = 0;
    else this.offset = this.currentTime;
    this.startedAt = performance.now();
    this.running = true;
    this.emitter.emit('play');
    this.tick();
  }

  pause(): void {
    if (!this.running) return;
    this.offset = this.clampTime(this.now());
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.emitter.emit('pause');
  }

  async seek(time: number): Promise<void> {
    this.offset = this.clampTime(time);
    this.startedAt = performance.now();
    await this.renderAt(this.offset);
    this.emitter.emit('timeupdate');
    this.emitter.emit('seeked');
  }

  on(event: SourceEvent, handler: Handler): () => void {
    return this.emitter.on(event, handler);
  }

  protected tick = (): void => {
    if (!this.running) return;
    const time = this.now();
    if (time >= this.duration) {
      this.offset = this.duration;
      this.running = false;
      this.rafId = null;
      void this.renderAt(this.duration);
      this.emitter.emit('timeupdate');
      this.emitter.emit('ended');
      this.emitter.emit('pause');
      return;
    }
    void this.renderAt(time);
    this.emitter.emit('timeupdate');
    this.rafId = requestAnimationFrame(this.tick);
  };

  protected stopClock(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Produces the pixels for `time`. */
  protected abstract renderAt(time: number): void | Promise<void>;
}
