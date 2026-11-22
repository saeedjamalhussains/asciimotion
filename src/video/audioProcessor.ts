/**
 * Audio handling.
 *
 * The original soundtrack is decoded with Web Audio, trimmed to the selected
 * range, and re-encoded with the browser's `AudioEncoder`. If the browser
 * cannot encode it, the export is silent and the UI says so.
 */

import { yieldToUi } from './frameProcessor';

export class AudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioUnavailableError';
  }
}

function createAudioContext(sampleRate?: number): AudioContext {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new AudioUnavailableError('Web Audio is not available in this browser.');
  return sampleRate ? new Ctor({ sampleRate }) : new Ctor();
}

export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  frameCount: number;
}

/**
 * Decodes the file's audio track and slices it to `[start, end)`.
 * Returns `null` when the file has no decodable audio.
 */
export async function decodeTrimmedAudio(
  file: File,
  start: number,
  end: number,
): Promise<DecodedAudio | null> {
  let context: AudioContext | null = null;
  try {
    const buffer = await file.arrayBuffer();
    context = createAudioContext();
    const audioBuffer = await context.decodeAudioData(buffer);
    if (audioBuffer.numberOfChannels === 0 || audioBuffer.length === 0) return null;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor(start * sampleRate));
    const endSample = Math.min(audioBuffer.length, Math.ceil(end * sampleRate));
    const frameCount = Math.max(0, endSample - startSample);
    if (frameCount === 0) return null;

    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c += 1) {
      const full = audioBuffer.getChannelData(c);
      channels.push(full.slice(startSample, endSample));
    }
    return {
      channels,
      sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      frameCount,
    };
  } catch {
    return null;
  } finally {
    if (context) void context.close().catch(() => undefined);
  }
}

export interface AudioEncodeHandlers {
  onChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void;
  signal?: AbortSignal;
}

/**
 * Feeds decoded PCM into an `AudioEncoder` in planar float chunks.
 * Resolves once the encoder has flushed everything to the muxer.
 */
export async function encodeAudio(
  audio: DecodedAudio,
  codec: string,
  bitrate: number,
  handlers: AudioEncodeHandlers,
): Promise<void> {
  if (typeof AudioEncoder === 'undefined') {
    throw new AudioUnavailableError('This browser has no local audio encoder.');
  }

  let encoderError: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => handlers.onChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });

  encoder.configure({
    codec,
    sampleRate: audio.sampleRate,
    numberOfChannels: audio.numberOfChannels,
    bitrate,
  });

  const chunkFrames = 1024 * 10;
  const channelCount = audio.numberOfChannels;
  const planar = new Float32Array(chunkFrames * channelCount);

  for (let offset = 0; offset < audio.frameCount; offset += chunkFrames) {
    if (handlers.signal?.aborted) break;
    if (encoderError) break;
    const frames = Math.min(chunkFrames, audio.frameCount - offset);
    for (let c = 0; c < channelCount; c += 1) {
      planar.set(audio.channels[c].subarray(offset, offset + frames), c * frames);
    }
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: audio.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channelCount,
      timestamp: Math.round((offset / audio.sampleRate) * 1_000_000),
      data: planar.subarray(0, frames * channelCount),
    });
    encoder.encode(data);
    data.close();

    if (encoder.encodeQueueSize > 12) {
      await yieldToUi();
    }
  }

  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;
}

/**
 * Routes a media element through Web Audio so a MediaRecorder export can
 * capture the soundtrack while the speakers stay silent.
 */
export class ElementAudioTap {
  private context: AudioContext;
  private source: MediaElementAudioSourceNode;
  private monitor: GainNode;
  private destination: MediaStreamAudioDestinationNode;
  private closed = false;

  constructor(element: HTMLMediaElement) {
    this.context = createAudioContext();
    this.source = this.context.createMediaElementSource(element);
    this.monitor = this.context.createGain();
    this.destination = this.context.createMediaStreamDestination();
    this.source.connect(this.monitor);
    this.monitor.connect(this.context.destination);
    this.source.connect(this.destination);
  }

  get track(): MediaStreamTrack | null {
    return this.destination.stream.getAudioTracks()[0] ?? null;
  }

  setMonitorGain(value: number): void {
    this.monitor.gain.value = value;
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /** Leaves the element audible through the graph; safe to call repeatedly. */
  release(): void {
    if (this.closed) return;
    this.monitor.gain.value = 1;
    try {
      this.source.disconnect(this.destination);
    } catch {
      /* already disconnected */
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.release();
    void this.context.close().catch(() => undefined);
  }
}

/** Cheap heuristic bitrate for the chosen quality level. */
export function audioBitrateFor(quality: 'standard' | 'high' | 'maximum'): number {
  return quality === 'standard' ? 96000 : quality === 'high' ? 128000 : 192000;
}
