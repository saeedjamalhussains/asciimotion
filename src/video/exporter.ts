import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer';

import { AsciiRenderer } from '../renderer/asciiRenderer';
import { createCanvas, get2d, resizeCanvas, type AnyCanvas, type Ctx2D } from '../renderer/canvasRenderer';
import { backgroundColor } from '../renderer/colorProcessor';
import { QUALITY_BITRATE_FACTOR } from '../state/settings';
import type {
  EditorSettings,
  ExportProgressState,
  ExportResult,
  ExportSettings,
  TrimRange,
} from '../types';
import { buildExportFilename } from '../utils/fileHandling';
import { audioBitrateFor, decodeTrimmedAudio, encodeAudio, ElementAudioTap } from './audioProcessor';
import { evenDimension, extensionFor, mimeFor, type FormatSupport } from './codecSupport';
import { FrameWalker, nextFrame, yieldToUi } from './frameProcessor';
import type { FrameSource } from './frameSource';

/**
 * Export pipeline.
 *
 * Three strategies, in order of preference:
 *
 *   1. WebCodecs — frame-accurate. Each frame is seeked, rendered and encoded,
 *      then muxed in-page with `mp4-muxer` / `webm-muxer`. Audio is decoded
 *      from the source file and re-encoded with `AudioEncoder`.
 *   2. MediaRecorder — real-time capture of the ASCII canvas, with audio tapped
 *      from the media element through Web Audio.
 *   3. GIF — frames quantised and compressed in a worker.
 *
 * All three finish with a `Blob` and an object URL.
 */

export class ExportError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'ExportError';
    this.hint = hint;
  }
}

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelled';
  }
}

export interface ExportJob {
  source: FrameSource;
  /** The original file, used only for local audio decoding. */
  file: File | null;
  settings: EditorSettings;
  exportSettings: ExportSettings;
  support: FormatSupport;
  trim: TrimRange;
  onProgress(state: ExportProgressState): void;
  signal: AbortSignal;
}

interface OutputPlan {
  width: number;
  height: number;
}

const PREVIEW_PIXEL_CAP = 2560;

/** Works out the exported frame size from the chosen preset. */
export function planOutput(
  settings: EditorSettings,
  exportSettings: ExportSettings,
  sourceWidth: number,
  sourceHeight: number,
): OutputPlan {
  const probe = new AsciiRenderer(createCanvas(2, 2));
  const natural = probe.measure({
    settings,
    sourceWidth,
    sourceHeight,
    frameIndex: 0,
    maxWidth: PREVIEW_PIXEL_CAP,
    maxHeight: PREVIEW_PIXEL_CAP,
  });
  probe.dispose();
  const ratio = natural.width / natural.height;

  switch (exportSettings.resolutionPreset) {
    case '720p':
      return { width: evenDimension(720 * ratio), height: evenDimension(720) };
    case '1080p':
      return { width: evenDimension(1080 * ratio), height: evenDimension(1080) };
    case 'custom':
      return {
        width: evenDimension(Math.max(64, Math.min(3840, exportSettings.customWidth))),
        height: evenDimension(Math.max(64, Math.min(3840, exportSettings.customHeight))),
      };
    default:
      return { width: evenDimension(natural.width), height: evenDimension(natural.height) };
  }
}

function bitrateFor(
  width: number,
  height: number,
  fps: number,
  quality: ExportSettings['quality'],
): number {
  const raw = width * height * fps * QUALITY_BITRATE_FACTOR[quality];
  return Math.round(Math.max(500_000, Math.min(40_000_000, raw)));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new ExportCancelled();
}

/** Draws the ASCII raster into the exact export frame, letterboxed if needed. */
class FrameComposer {
  readonly canvas: AnyCanvas;
  private ctx: Ctx2D;
  private renderer: AsciiRenderer;
  private plan: OutputPlan;
  private settings: EditorSettings;
  private sourceWidth: number;
  private sourceHeight: number;

  constructor(
    plan: OutputPlan,
    settings: EditorSettings,
    sourceWidth: number,
    sourceHeight: number,
  ) {
    this.plan = plan;
    this.settings = settings;
    this.sourceWidth = sourceWidth;
    this.sourceHeight = sourceHeight;
    this.canvas = createCanvas(plan.width, plan.height);
    this.ctx = get2d(this.canvas);
    this.renderer = new AsciiRenderer(createCanvas(2, 2));
  }

  draw(image: CanvasImageSource, frameIndex: number): void {
    const info = this.renderer.render(image, {
      settings: this.settings,
      sourceWidth: this.sourceWidth,
      sourceHeight: this.sourceHeight,
      frameIndex,
      maxWidth: this.plan.width,
      maxHeight: this.plan.height,
      targetWidth: this.plan.width,
      targetHeight: this.plan.height,
    });

    resizeCanvas(this.canvas, this.plan.width, this.plan.height);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, this.plan.width, this.plan.height);

    const background = backgroundColor(this.settings);
    if (background) {
      this.ctx.fillStyle = background;
      this.ctx.fillRect(0, 0, this.plan.width, this.plan.height);
    }

    const scale = Math.min(this.plan.width / info.width, this.plan.height / info.height);
    const dw = Math.round(info.width * scale);
    const dh = Math.round(info.height * scale);
    this.ctx.drawImage(
      this.renderer.canvas as CanvasImageSource,
      Math.round((this.plan.width - dw) / 2),
      Math.round((this.plan.height - dh) / 2),
      dw,
      dh,
    );
  }

  readPixels(): ImageData {
    return this.ctx.getImageData(0, 0, this.plan.width, this.plan.height);
  }

  dispose(): void {
    this.renderer.dispose();
    resizeCanvas(this.canvas, 1, 1);
  }
}

function progress(
  job: ExportJob,
  patch: Partial<ExportProgressState> & Pick<ExportProgressState, 'phase'>,
  totalSeconds: number,
): void {
  job.onProgress({
    progress: 0,
    renderedSeconds: 0,
    totalSeconds,
    message: '',
    etaSeconds: null,
    ...patch,
  });
}

// ---------------------------------------------------------------------------
// Strategy 1 — WebCodecs
// ---------------------------------------------------------------------------

async function exportWithWebCodecs(job: ExportJob, plan: OutputPlan): Promise<ExportResult> {
  const { settings, exportSettings, support, trim, source, signal } = job;
  if (!support.videoCodec) {
    throw new ExportError(
      'No video encoder was available.',
      'Try WebM, or open ASCII Motion in Chrome or Edge.',
    );
  }

  const totalSeconds = trim.end - trim.start;
  const walker = new FrameWalker({ source, start: trim.start, end: trim.end, fps: exportSettings.fps });
  const composer = new FrameComposer(plan, settings, source.info.width, source.info.height);
  const notes: string[] = [];

  // --- Audio, decoded and re-encoded entirely on-device. ---
  const wantsAudio = exportSettings.includeAudio && source.info.hasAudio && Boolean(job.file);
  let audio = null;
  if (wantsAudio) {
    if (!support.audioCodec) {
      notes.push('Your browser has no encoder for this format’s audio, so the export is silent.');
    } else {
      progress(job, { phase: 'preparing', message: 'Reading the original soundtrack…' }, totalSeconds);
      audio = await decodeTrimmedAudio(job.file as File, trim.start, trim.end);
      if (!audio) {
        notes.push('The original audio track could not be decoded, so the export is silent.');
      }
    }
  } else if (exportSettings.includeAudio && !source.info.hasAudio) {
    notes.push('This clip has no audio track.');
  }

  const isMp4 = exportSettings.format === 'mp4';
  const target = isMp4 ? new Mp4Target() : new WebmTarget();
  const muxer = isMp4
    ? new Mp4Muxer({
        target: target as Mp4Target,
        fastStart: 'in-memory',
        video: { codec: 'avc', width: plan.width, height: plan.height, frameRate: exportSettings.fps },
        audio: audio
          ? { codec: 'aac', numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate }
          : undefined,
      })
    : new WebmMuxer({
        target: target as WebmTarget,
        video: {
          codec: support.videoCodec.startsWith('vp8') ? 'V_VP8' : 'V_VP9',
          width: plan.width,
          height: plan.height,
          frameRate: exportSettings.fps,
        },
        audio: audio
          ? { codec: 'A_OPUS', numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate }
          : undefined,
      });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (muxer as any).addVideoChunk(chunk, meta);
    },
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });

  try {
    encoder.configure({
      codec: support.videoCodec,
      width: plan.width,
      height: plan.height,
      framerate: exportSettings.fps,
      bitrate: bitrateFor(plan.width, plan.height, exportSettings.fps, exportSettings.quality),
      latencyMode: 'quality',
      ...(isMp4 ? { avc: { format: 'avc' as const } } : {}),
    });
  } catch (error) {
    encoder.close();
    composer.dispose();
    throw new ExportError(
      'Your browser refused this encoder configuration.',
      `Try a smaller resolution or the WebM format. (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  const wasPaused = source.paused;
  source.pause();

  const startedAt = performance.now();
  const frameDurationUs = Math.round(1_000_000 / exportSettings.fps);
  const keyframeInterval = Math.max(1, Math.round(exportSettings.fps * 2));

  try {
    for (let index = 0; index < walker.frameCount; index += 1) {
      throwIfAborted(signal);
      if (encoderError) throw encoderError;

      await walker.seekTo(index);
      const image = source.image;
      if (!image) throw new ExportError('The video frame was not available.', 'Reload and try again.');
      composer.draw(image, index);

      const frame = new VideoFrame(composer.canvas as CanvasImageSource, {
        timestamp: index * frameDurationUs,
        duration: frameDurationUs,
      });
      encoder.encode(frame, { keyFrame: index % keyframeInterval === 0 });
      frame.close();

      // Backpressure: never let the encoder queue run away with memory.
      while (encoder.encodeQueueSize > 6) {
        throwIfAborted(signal);
        await yieldToUi();
      }

      const done = (index + 1) / walker.frameCount;
      const elapsed = (performance.now() - startedAt) / 1000;
      progress(
        job,
        {
          phase: 'rendering',
          progress: done * (audio ? 0.9 : 1),
          renderedSeconds: Math.min(totalSeconds, (index + 1) / exportSettings.fps),
          message: 'Rendering ASCII frames…',
          etaSeconds: done > 0.02 ? elapsed / done - elapsed : null,
        },
        totalSeconds,
      );

      if (index % 4 === 0) await yieldToUi();
    }

    throwIfAborted(signal);
    progress(job, { phase: 'encoding', progress: 0.92, renderedSeconds: totalSeconds, message: 'Finishing the video track…' }, totalSeconds);
    await encoder.flush();
    if (encoderError) throw encoderError;

    if (audio && support.audioCodec) {
      progress(job, { phase: 'encoding', progress: 0.95, renderedSeconds: totalSeconds, message: 'Encoding audio…' }, totalSeconds);
      try {
        await encodeAudio(
          audio,
          support.audioCodec,
          audioBitrateFor(exportSettings.quality),
          {
            signal,
            onChunk: (chunk, meta) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (muxer as any).addAudioChunk(chunk, meta);
            },
          },
        );
      } catch (error) {
        notes.push(
          `Audio could not be encoded (${
            error instanceof Error ? error.message : 'unknown error'
          }), so the export is silent.`,
        );
        audio = null;
      }
    }

    throwIfAborted(signal);
    progress(job, { phase: 'finalizing', progress: 0.98, renderedSeconds: totalSeconds, message: 'Writing the file…' }, totalSeconds);
    muxer.finalize();

    const buffer = (target as Mp4Target | WebmTarget).buffer;
    const blob = new Blob([buffer], { type: mimeFor(exportSettings.format) });
    const url = URL.createObjectURL(blob);

    return {
      blob,
      url,
      filename: buildExportFilename(source.info.name, extensionFor(exportSettings.format)),
      durationSeconds: walker.frameCount / exportSettings.fps,
      width: plan.width,
      height: plan.height,
      hasAudio: Boolean(audio),
      notes,
    };
  } finally {
    try {
      encoder.close();
    } catch {
      /* already closed */
    }
    composer.dispose();
    if (!wasPaused) void source.play().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Strategy 2 — MediaRecorder (real-time)
// ---------------------------------------------------------------------------

async function exportWithMediaRecorder(job: ExportJob, plan: OutputPlan): Promise<ExportResult> {
  const { settings, exportSettings, support, trim, source, signal } = job;
  if (!support.recorderMime) {
    throw new ExportError(
      'MediaRecorder is not available in this browser.',
      'Try Chrome, Edge or Firefox, or pick the WebM format.',
    );
  }

  const totalSeconds = trim.end - trim.start;
  const composer = new FrameComposer(plan, settings, source.info.width, source.info.height);
  const notes: string[] = [
    'Recorded in real time, so the exported timing follows playback rather than exact frame stepping.',
  ];

  // MediaRecorder needs a DOM canvas to capture from.
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = plan.width;
  captureCanvas.height = plan.height;
  const captureCtx = captureCanvas.getContext('2d');
  if (!captureCtx) throw new ExportError('Could not create a capture canvas.', 'Reload and try again.');

  const stream = captureCanvas.captureStream(exportSettings.fps);

  let tap: ElementAudioTap | null = null;
  let hasAudio = false;
  const element = source.element;
  const previousVolume = element?.volume ?? 1;
  const previousMuted = element?.muted ?? false;

  if (exportSettings.includeAudio && source.info.hasAudio && element && support.canIncludeAudio) {
    try {
      tap = new ElementAudioTap(element);
      await tap.resume();
      tap.setMonitorGain(0);
      element.muted = false;
      element.volume = 1;
      const track = tap.track;
      if (track) {
        stream.addTrack(track);
        hasAudio = true;
      }
    } catch {
      notes.push('The soundtrack could not be captured in this browser, so the export is silent.');
      tap?.close();
      tap = null;
    }
  } else if (exportSettings.includeAudio && source.info.hasAudio) {
    notes.push('This format cannot carry audio in your browser, so the export is silent.');
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: support.recorderMime,
    videoBitsPerSecond: bitrateFor(plan.width, plan.height, exportSettings.fps, exportSettings.quality),
  });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new ExportError('Recording failed.', 'Try a lower resolution or the WebM format.'));
  });

  let frameIndex = 0;
  let rafId = 0;
  let finished = false;
  const startedAt = performance.now();

  const pump = () => {
    if (finished) return;
    const image = source.image;
    if (image) {
      composer.draw(image, frameIndex);
      captureCtx.clearRect(0, 0, plan.width, plan.height);
      captureCtx.drawImage(composer.canvas as CanvasImageSource, 0, 0);
      frameIndex += 1;
    }
    const rendered = Math.max(0, Math.min(totalSeconds, source.currentTime - trim.start));
    const done = totalSeconds > 0 ? rendered / totalSeconds : 1;
    const elapsed = (performance.now() - startedAt) / 1000;
    progress(
      job,
      {
        phase: 'rendering',
        progress: done * 0.97,
        renderedSeconds: rendered,
        message: 'Recording the ASCII animation in real time…',
        etaSeconds: done > 0.02 ? elapsed / done - elapsed : null,
      },
      totalSeconds,
    );
    if (source.currentTime >= trim.end - 0.02 || source.paused) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(pump);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    source.pause();
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const onAbort = () => finish();
  signal.addEventListener('abort', onAbort);

  try {
    source.playbackRate = 1;
    await source.seek(trim.start);
    await nextFrame();
    recorder.start(250);
    await source.play();
    rafId = requestAnimationFrame(pump);
    await stopped;
    throwIfAborted(signal);

    progress(job, { phase: 'finalizing', progress: 0.99, renderedSeconds: totalSeconds, message: 'Writing the file…' }, totalSeconds);
    const blob = new Blob(chunks, { type: support.recorderMime.split(';')[0] });
    if (blob.size === 0) {
      throw new ExportError(
        'The recording came back empty.',
        'This usually means the tab lost focus mid-export. Keep the tab visible and try again.',
      );
    }
    const url = URL.createObjectURL(blob);
    return {
      blob,
      url,
      filename: buildExportFilename(
        source.info.name,
        support.recorderMime.includes('mp4') ? 'mp4' : 'webm',
      ),
      durationSeconds: totalSeconds,
      width: plan.width,
      height: plan.height,
      hasAudio,
      notes,
    };
  } finally {
    signal.removeEventListener('abort', onAbort);
    finish();
    composer.dispose();
    for (const track of stream.getTracks()) track.stop();
    if (tap) {
      tap.close();
      if (element) {
        element.volume = previousVolume;
        element.muted = previousMuted;
      }
    }
    captureCanvas.width = 1;
    captureCanvas.height = 1;
  }
}

// ---------------------------------------------------------------------------
// Strategy 3 — GIF
// ---------------------------------------------------------------------------

async function exportGif(job: ExportJob, plan: OutputPlan): Promise<ExportResult> {
  const { settings, exportSettings, trim, source, signal } = job;
  const totalSeconds = trim.end - trim.start;
  const fps = Math.min(exportSettings.fps, 50);
  const walker = new FrameWalker({ source, start: trim.start, end: trim.end, fps });
  const composer = new FrameComposer(plan, settings, source.info.width, source.info.height);

  const worker = new Worker(new URL('../workers/exportWorker.ts', import.meta.url), {
    type: 'module',
  });

  const notes: string[] = ['GIF is limited to 256 colours per frame and cannot carry audio.'];
  if (plan.width * plan.height > 640 * 640) {
    notes.push('Large GIFs get big quickly — 480p or smaller keeps the file manageable.');
  }

  const wasPaused = source.paused;
  source.pause();
  const startedAt = performance.now();

  try {
    const maxColors =
      exportSettings.quality === 'standard' ? 96 : exportSettings.quality === 'high' ? 192 : 256;

    worker.postMessage({
      type: 'begin',
      width: plan.width,
      height: plan.height,
      maxColors,
      transparent: settings.background === 'transparent',
    });

    const delayMs = Math.round(1000 / fps);

    for (let index = 0; index < walker.frameCount; index += 1) {
      throwIfAborted(signal);
      await walker.seekTo(index);
      const image = source.image;
      if (!image) break;
      composer.draw(image, index);
      const pixels = composer.readPixels();
      const buffer = pixels.data.buffer;

      await new Promise<void>((resolve, reject) => {
        const onMessage = (event: MessageEvent) => {
          const data = event.data as { type: string; message?: string };
          if (data.type === 'frame-done') {
            worker.removeEventListener('message', onMessage);
            resolve();
          } else if (data.type === 'error') {
            worker.removeEventListener('message', onMessage);
            reject(new ExportError('GIF encoding failed.', data.message ?? 'Try a smaller size.'));
          }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ type: 'frame', pixels: buffer, delayMs }, [buffer]);
      });

      const done = (index + 1) / walker.frameCount;
      const elapsed = (performance.now() - startedAt) / 1000;
      progress(
        job,
        {
          phase: 'rendering',
          progress: done * 0.95,
          renderedSeconds: Math.min(totalSeconds, (index + 1) / fps),
          message: 'Rendering and quantising GIF frames…',
          etaSeconds: done > 0.02 ? elapsed / done - elapsed : null,
        },
        totalSeconds,
      );
      if (index % 4 === 0) await yieldToUi();
    }

    throwIfAborted(signal);
    progress(job, { phase: 'finalizing', progress: 0.97, renderedSeconds: totalSeconds, message: 'Assembling the GIF…' }, totalSeconds);

    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { type: string; bytes?: ArrayBuffer; message?: string };
        if (data.type === 'result' && data.bytes) {
          worker.removeEventListener('message', onMessage);
          resolve(data.bytes);
        } else if (data.type === 'error') {
          worker.removeEventListener('message', onMessage);
          reject(new ExportError('GIF encoding failed.', data.message ?? 'Try a smaller size.'));
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'finish' });
    });

    const blob = new Blob([bytes], { type: 'image/gif' });
    return {
      blob,
      url: URL.createObjectURL(blob),
      filename: buildExportFilename(source.info.name, 'gif'),
      durationSeconds: walker.frameCount / fps,
      width: plan.width,
      height: plan.height,
      hasAudio: false,
      notes,
    };
  } finally {
    worker.postMessage({ type: 'abort' });
    worker.terminate();
    composer.dispose();
    if (!wasPaused) void source.play().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------

export async function runExport(job: ExportJob): Promise<ExportResult> {
  const totalSeconds = job.trim.end - job.trim.start;
  if (totalSeconds <= 0) {
    throw new ExportError('The selected range is empty.', 'Drag the trim handles apart and try again.');
  }

  const plan = planOutput(job.settings, job.exportSettings, job.source.info.width, job.source.info.height);
  if (plan.width * plan.height > 3840 * 2160) {
    throw new ExportError(
      'That output size is too large to encode in a browser tab.',
      'Pick 1080p or a smaller custom size.',
    );
  }

  progress(job, { phase: 'preparing', message: 'Preparing the encoder…' }, totalSeconds);

  try {
    if (job.exportSettings.format === 'gif') return await exportGif(job, plan);
    if (job.support.strategy === 'webcodecs') return await exportWithWebCodecs(job, plan);
    if (job.support.strategy === 'mediarecorder') return await exportWithMediaRecorder(job, plan);
    throw new ExportError(
      'Your browser cannot encode this format.',
      'Try WebM, or use Chrome or Edge for the widest codec support.',
    );
  } catch (error) {
    if (error instanceof ExportCancelled) throw error;
    if (error instanceof ExportError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/memory|allocat/i.test(message)) {
      throw new ExportError(
        'The browser ran out of memory while encoding.',
        'Try a shorter trim range, a lower resolution, or a smaller frame rate.',
      );
    }
    throw new ExportError('Encoding failed part-way through.', message);
  }
}
