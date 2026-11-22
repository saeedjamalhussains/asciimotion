import type { ExportFormat } from '../types';
import { getCapabilities, pickRecorderMime } from '../utils/browserSupport';

/**
 * Encoder discovery.
 *
 * Encoding uses what the browser itself provides: WebCodecs first, with
 * MediaRecorder as a fallback.
 */

export type EncoderStrategy = 'webcodecs' | 'mediarecorder' | 'gif' | 'none';

export interface FormatSupport {
  format: ExportFormat;
  available: boolean;
  strategy: EncoderStrategy;
  /** Codec string handed to `VideoEncoder`, when that path is used. */
  videoCodec?: string;
  audioCodec?: string;
  /** MediaRecorder mime type, when that path is used. */
  recorderMime?: string;
  canIncludeAudio: boolean;
  note?: string;
}

const AVC_CANDIDATES = ['avc1.640028', 'avc1.4d0028', 'avc1.42003e', 'avc1.42001f'];
const VP9_CANDIDATES = ['vp09.00.10.08', 'vp09.00.41.08'];
const VP8_CANDIDATE = 'vp8';

const RECORDER_WEBM = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];
const RECORDER_MP4 = [
  'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
  'video/mp4;codecs=avc1.42001f,mp4a.40.2',
  'video/mp4;codecs=avc1.42001f',
  'video/mp4',
];

async function firstSupportedVideoCodec(
  candidates: string[],
  width: number,
  height: number,
  framerate: number,
): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of candidates) {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        framerate,
        bitrate: 4_000_000,
      });
      if (result.supported) return codec;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

async function audioCodecSupported(codec: string): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') return false;
  try {
    const result = await AudioEncoder.isConfigSupported({
      codec,
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });
    return Boolean(result.supported);
  } catch {
    return false;
  }
}

/** Even dimensions are required by most hardware encoders. */
export function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export async function probeFormat(
  format: ExportFormat,
  width: number,
  height: number,
  framerate: number,
): Promise<FormatSupport> {
  const caps = getCapabilities();
  const w = evenDimension(width);
  const h = evenDimension(height);

  if (format === 'gif') {
    return {
      format,
      available: true,
      strategy: 'gif',
      canIncludeAudio: false,
      note: 'GIF is limited to 256 colours per frame and carries no audio.',
    };
  }

  if (format === 'mp4') {
    if (caps.videoEncoder) {
      const videoCodec = await firstSupportedVideoCodec(AVC_CANDIDATES, w, h, framerate);
      if (videoCodec) {
        const aac = await audioCodecSupported('mp4a.40.2');
        return {
          format,
          available: true,
          strategy: 'webcodecs',
          videoCodec,
          audioCodec: aac ? 'mp4a.40.2' : undefined,
          canIncludeAudio: aac,
          note: aac ? undefined : 'Your browser has no AAC encoder, so MP4 export will be silent.',
        };
      }
    }
    const recorderMime = pickRecorderMime(RECORDER_MP4);
    if (recorderMime) {
      return {
        format,
        available: true,
        strategy: 'mediarecorder',
        recorderMime,
        canIncludeAudio: recorderMime.includes('mp4a') || !recorderMime.includes('codecs'),
        note: 'Recorded in real time, so a long clip takes as long as it plays.',
      };
    }
    return {
      format,
      available: false,
      strategy: 'none',
      canIncludeAudio: false,
      note: 'Your browser cannot encode MP4. Try WebM, or use Chrome or Edge for MP4.',
    };
  }

  // WebM
  if (caps.videoEncoder) {
    const videoCodec =
      (await firstSupportedVideoCodec(VP9_CANDIDATES, w, h, framerate)) ??
      (await firstSupportedVideoCodec([VP8_CANDIDATE], w, h, framerate));
    if (videoCodec) {
      const opus = await audioCodecSupported('opus');
      return {
        format,
        available: true,
        strategy: 'webcodecs',
        videoCodec,
        audioCodec: opus ? 'opus' : undefined,
        canIncludeAudio: opus,
        note: opus ? undefined : 'Your browser has no Opus encoder, so WebM export will be silent.',
      };
    }
  }
  const recorderMime = pickRecorderMime(RECORDER_WEBM);
  if (recorderMime) {
    return {
      format,
      available: true,
      strategy: 'mediarecorder',
      recorderMime,
      canIncludeAudio: recorderMime.includes('opus') || !recorderMime.includes('codecs'),
      note: 'Recorded in real time, so a long clip takes as long as it plays.',
    };
  }

  return {
    format,
    available: false,
    strategy: 'none',
    canIncludeAudio: false,
    note: 'This browser exposes no video encoder. Chrome, Edge or a recent Safari will work.',
  };
}

export async function probeAllFormats(
  width: number,
  height: number,
  framerate: number,
): Promise<Record<ExportFormat, FormatSupport>> {
  const [webm, mp4, gif] = await Promise.all([
    probeFormat('webm', width, height, framerate),
    probeFormat('mp4', width, height, framerate),
    probeFormat('gif', width, height, framerate),
  ]);
  return { webm, mp4, gif };
}

export function extensionFor(format: ExportFormat): string {
  return format === 'mp4' ? 'mp4' : format === 'gif' ? 'gif' : 'webm';
}

export function mimeFor(format: ExportFormat): string {
  return format === 'mp4' ? 'video/mp4' : format === 'gif' ? 'image/gif' : 'video/webm';
}
