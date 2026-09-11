/**
 * Feature probes. Everything here is synchronous, cheap and cached.
 */

export interface BrowserCapabilities {
  webCodecs: boolean;
  videoEncoder: boolean;
  audioEncoder: boolean;
  audioDecoder: boolean;
  mediaRecorder: boolean;
  offscreenCanvas: boolean;
  transferControlToOffscreen: boolean;
  captureStream: boolean;
  webAudio: boolean;
  requestVideoFrameCallback: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isChromium: boolean;
  isMobile: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number;
}

let cached: BrowserCapabilities | null = null;

export function getCapabilities(): BrowserCapabilities {
  if (cached) return cached;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const isChromium =
    typeof window !== 'undefined' && 'chrome' in window && !/OPR|Edg\/1[0-8]/.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);

  let transferControlToOffscreen = false;
  try {
    transferControlToOffscreen =
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function' &&
      typeof OffscreenCanvas !== 'undefined';
  } catch {
    transferControlToOffscreen = false;
  }

  cached = {
    webCodecs: typeof window !== 'undefined' && 'VideoEncoder' in window,
    videoEncoder: typeof window !== 'undefined' && 'VideoEncoder' in window,
    audioEncoder: typeof window !== 'undefined' && 'AudioEncoder' in window,
    audioDecoder: typeof window !== 'undefined' && 'AudioDecoder' in window,
    mediaRecorder: typeof window !== 'undefined' && 'MediaRecorder' in window,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    transferControlToOffscreen,
    captureStream:
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function',
    webAudio:
      typeof window !== 'undefined' &&
      ('AudioContext' in window || 'webkitAudioContext' in window),
    requestVideoFrameCallback:
      typeof HTMLVideoElement !== 'undefined' &&
      'requestVideoFrameCallback' in HTMLVideoElement.prototype,
    isSafari,
    isFirefox,
    isChromium,
    isMobile: /android|iphone|ipad|ipod/i.test(ua) || (isSafari && navigator.maxTouchPoints > 1),
    deviceMemoryGb:
      typeof navigator !== 'undefined' && 'deviceMemory' in navigator
        ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
        : null,
    hardwareConcurrency:
      typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4,
  };
  return cached;
}

export function supportsMediaRecorderMime(mime: string): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  try {
    return MediaRecorder.isTypeSupported(mime);
  } catch {
    return false;
  }
}

/** Returns the first MediaRecorder mime type the browser accepts. */
export function pickRecorderMime(candidates: string[]): string | null {
  for (const mime of candidates) {
    if (supportsMediaRecorderMime(mime)) return mime;
  }
  return null;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
