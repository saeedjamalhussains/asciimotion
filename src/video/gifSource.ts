import type { MediaInfo } from '../types';
import { createCanvas, get2d, type AnyCanvas, type Ctx2D } from '../renderer/canvasRenderer';
import { ClockSource, type FrameSource } from './frameSource';
import { MediaLoadError } from './videoLoader';

/**
 * Animated GIF support via `ImageDecoder` — a local, in-browser decoder.
 *
 * Frames are decoded on demand and composited onto a persistent canvas so
 * partial-frame GIFs (the common case) stay correct while scrubbing.
 */

interface ImageDecoderResult {
  image: VideoFrame;
}

interface ImageDecoderTrack {
  frameCount: number;
  animated: boolean;
  repetitionCount: number;
}

interface ImageDecoderLike {
  tracks: {
    ready: Promise<void>;
    selectedTrack: ImageDecoderTrack | null;
  };
  completed: Promise<void>;
  decode(options: { frameIndex: number }): Promise<ImageDecoderResult>;
  close(): void;
}

type ImageDecoderCtor = new (init: { data: ArrayBuffer | Uint8Array; type: string }) => ImageDecoderLike;

export function supportsGifDecoding(): boolean {
  return typeof window !== 'undefined' && 'ImageDecoder' in window;
}

export class GifFrameSource extends ClockSource implements FrameSource {
  readonly kind = 'gif' as const;
  readonly info: MediaInfo;
  readonly element = null;

  private decoder: ImageDecoderLike;
  private canvas: AnyCanvas;
  private ctx: Ctx2D;
  private starts: Float64Array;
  private total: number;
  private currentIndex = -1;
  private pending: Promise<void> | null = null;

  constructor(
    decoder: ImageDecoderLike,
    starts: Float64Array,
    total: number,
    width: number,
    height: number,
    info: MediaInfo,
  ) {
    super();
    this.decoder = decoder;
    this.starts = starts;
    this.total = total;
    this.info = info;
    this.canvas = createCanvas(width, height);
    this.ctx = get2d(this.canvas);
  }

  get duration(): number {
    return this.total;
  }

  get image(): CanvasImageSource {
    return this.canvas as CanvasImageSource;
  }

  // GIFs carry no audio track.
  get volume(): number {
    return 0;
  }
  set volume(_value: number) {}
  get muted(): boolean {
    return true;
  }
  set muted(_value: boolean) {}

  private indexForTime(time: number): number {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid] <= time) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  protected async renderAt(time: number): Promise<void> {
    const index = this.indexForTime(time);
    if (index === this.currentIndex) return;
    if (this.pending) await this.pending;
    this.pending = this.decodeInto(index);
    await this.pending;
    this.pending = null;
  }

  private async decodeInto(index: number): Promise<void> {
    try {
      const { image } = await this.decoder.decode({ frameIndex: index });
      // Rewinding requires a clean slate; forward playback composites.
      if (index === 0 || index < this.currentIndex) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.ctx.drawImage(image, 0, 0);
      image.close();
      this.currentIndex = index;
      this.token += 1;
    } catch {
      /* A frame that fails to decode leaves the previous one on screen. */
    }
  }

  /** Ensures the frame for the current time is drawn (used right after load). */
  async prime(): Promise<void> {
    await this.decodeInto(0);
  }

  dispose(): void {
    this.stopClock();
    this.emitter.clear();
    try {
      this.decoder.close();
    } catch {
      /* already closed */
    }
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}

export async function loadGifFile(file: File): Promise<GifFrameSource> {
  if (!supportsGifDecoding()) {
    throw new MediaLoadError(
      'Animated GIFs need a browser with the ImageDecoder API.',
      'Chrome, Edge and Safari 17+ can read GIFs here. In other browsers, convert the GIF to MP4 or WebM first.',
    );
  }
  const Decoder = (window as unknown as { ImageDecoder: ImageDecoderCtor }).ImageDecoder;
  const buffer = await file.arrayBuffer();
  const decoder = new Decoder({ data: buffer, type: file.type || 'image/gif' });

  await decoder.tracks.ready;
  const track = decoder.tracks.selectedTrack;
  if (!track || track.frameCount < 1) {
    decoder.close();
    throw new MediaLoadError('This GIF has no readable frames.', 'Try a different file.');
  }

  // Walk the frames once to build a timeline of start offsets.
  const starts = new Float64Array(track.frameCount);
  let elapsed = 0;
  let width = 0;
  let height = 0;
  for (let i = 0; i < track.frameCount; i += 1) {
    starts[i] = elapsed;
    const { image } = await decoder.decode({ frameIndex: i });
    if (i === 0) {
      width = image.displayWidth;
      height = image.displayHeight;
    }
    // `duration` is in microseconds; browsers clamp very short GIF delays.
    const durationUs = image.duration ?? 100000;
    elapsed += Math.max(0.02, durationUs / 1_000_000);
    image.close();
  }

  if (!width || !height) {
    decoder.close();
    throw new MediaLoadError('This GIF has no visible frames.', 'Try a different file.');
  }

  const source = new GifFrameSource(decoder, starts, elapsed, width, height, {
    name: file.name,
    size: file.size,
    type: file.type || 'image/gif',
    width,
    height,
    duration: elapsed,
    hasAudio: false,
  });
  await source.prime();
  return source;
}
