import type { MediaInfo } from '../types';
import { Emitter, type FrameSource, type SourceEvent } from './frameSource';

/** Loads a file into an `HTMLVideoElement` through an object URL. */

export class MediaLoadError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'MediaLoadError';
    this.hint = hint;
  }
}

function waitForEvent(target: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      target.removeEventListener(event, onDone);
      target.removeEventListener('error', onError);
      window.clearTimeout(timer);
    };
    const onDone = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(target.error?.message || 'The browser could not decode this file.'));
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Timed out while reading this file.'));
    }, timeoutMs);
    target.addEventListener(event, onDone, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

/**
 * Some containers report `duration: Infinity` until they are nudged. Seeking
 * far past the end forces the browser to resolve the real duration.
 */
async function resolveDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  return new Promise<number>((resolve) => {
    const onUpdate = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.removeEventListener('durationchange', onUpdate);
        video.currentTime = 0;
        resolve(video.duration);
      }
    };
    video.addEventListener('durationchange', onUpdate);
    video.currentTime = 1e7;
    window.setTimeout(() => {
      video.removeEventListener('durationchange', onUpdate);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    }, 3000);
  });
}

/** Best-effort audio detection using the vendor hints browsers expose. */
function detectAudio(video: HTMLVideoElement, mimeType: string): boolean {
  const withVendor = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (typeof withVendor.mozHasAudio === 'boolean') return withVendor.mozHasAudio;
  if (withVendor.audioTracks && typeof withVendor.audioTracks.length === 'number') {
    return withVendor.audioTracks.length > 0;
  }
  if (typeof withVendor.webkitAudioDecodedByteCount === 'number') {
    return withVendor.webkitAudioDecodedByteCount > 0;
  }
  // Unknown: assume a normal container carries audio and verify at export time.
  return !mimeType.startsWith('image/');
}

export class VideoFrameSource implements FrameSource {
  readonly kind = 'video' as const;
  readonly info: MediaInfo;
  readonly element: HTMLVideoElement;

  private objectUrl: string | null;
  private emitter = new Emitter();
  private token = 0;
  private detachers: (() => void)[] = [];
  private frameCallbackId: number | null = null;
  private disposed = false;

  constructor(video: HTMLVideoElement, objectUrl: string, info: MediaInfo) {
    this.element = video;
    this.objectUrl = objectUrl;
    this.info = info;

    const forward = (domEvent: string, sourceEvent: SourceEvent) => {
      const handler = () => {
        this.token += 1;
        this.emitter.emit(sourceEvent);
      };
      video.addEventListener(domEvent, handler);
      this.detachers.push(() => video.removeEventListener(domEvent, handler));
    };

    forward('play', 'play');
    forward('playing', 'play');
    forward('pause', 'pause');
    forward('ended', 'ended');
    forward('seeked', 'seeked');
    forward('timeupdate', 'timeupdate');
    forward('ratechange', 'ratechange');
    forward('volumechange', 'volumechange');
    forward('error', 'error');

    this.watchFrames();
  }

  /**
   * `requestVideoFrameCallback` tells us exactly when new pixels land, so the
   * preview can skip work on repeated frames. Without it we fall back to the
   * renderer's own time comparison.
   */
  private watchFrames(): void {
    const video = this.element as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };
    if (typeof video.requestVideoFrameCallback !== 'function') return;
    const step = () => {
      if (this.disposed) return;
      this.token += 1;
      this.frameCallbackId = video.requestVideoFrameCallback!(step);
    };
    this.frameCallbackId = video.requestVideoFrameCallback(step);
  }

  get image(): CanvasImageSource {
    return this.element;
  }

  get duration(): number {
    return this.info.duration;
  }

  get paused(): boolean {
    return this.element.paused;
  }

  get frameToken(): number {
    return this.token;
  }

  get currentTime(): number {
    return this.element.currentTime;
  }

  set currentTime(value: number) {
    this.element.currentTime = Math.max(0, Math.min(value, this.duration));
  }

  get playbackRate(): number {
    return this.element.playbackRate;
  }

  set playbackRate(value: number) {
    this.element.playbackRate = value;
  }

  get volume(): number {
    return this.element.volume;
  }

  set volume(value: number) {
    this.element.volume = Math.max(0, Math.min(1, value));
  }

  get muted(): boolean {
    return this.element.muted;
  }

  set muted(value: boolean) {
    this.element.muted = value;
  }

  async play(): Promise<void> {
    if (this.element.currentTime >= this.duration - 0.02) this.element.currentTime = 0;
    await this.element.play();
  }

  pause(): void {
    this.element.pause();
  }

  seek(time: number): Promise<void> {
    return seekVideo(this.element, Math.max(0, Math.min(time, this.duration)));
  }

  on(event: SourceEvent, handler: (payload?: unknown) => void): () => void {
    return this.emitter.on(event, handler);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const video = this.element as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
    if (this.frameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(this.frameCallbackId);
    }
    for (const detach of this.detachers) detach();
    this.detachers = [];
    this.emitter.clear();
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

/** Seeks and resolves when the new frame is actually presentable. */
export function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      window.clearTimeout(timer);
      resolve();
    };
    // A stalled seek must not deadlock an export.
    const timer = window.setTimeout(finish, 4000);
    video.addEventListener('seeked', finish);
    try {
      video.currentTime = time;
    } catch {
      finish();
    }
  });
}

export async function loadVideoFile(file: File): Promise<VideoFrameSource> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.muted = false;
  video.src = objectUrl;

  try {
    await waitForEvent(video, 'loadedmetadata', 30000);
    const duration = await resolveDuration(video);
    if (!video.videoWidth || !video.videoHeight) {
      throw new MediaLoadError(
        'This file has no visible video track.',
        'Audio-only files and some MOV variants cannot be turned into ASCII. Try an MP4 or WebM clip.',
      );
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new MediaLoadError(
        'The browser could not determine how long this clip is.',
        'Re-encoding the file as MP4 or WebM usually fixes this.',
      );
    }

    // Make sure the first frame is decoded before we hand the source over.
    await seekVideo(video, 0);

    return new VideoFrameSource(video, objectUrl, {
      name: file.name,
      size: file.size,
      type: file.type || 'video/*',
      width: video.videoWidth,
      height: video.videoHeight,
      duration,
      hasAudio: detectAudio(video, file.type || ''),
    });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
    video.load();
    if (error instanceof MediaLoadError) throw error;
    throw new MediaLoadError(
      'This video could not be decoded in your browser.',
      'Codecs differ between browsers. MP4 (H.264) and WebM (VP9) are the safest choices.',
    );
  }
}
