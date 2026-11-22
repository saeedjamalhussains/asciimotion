/// <reference lib="webworker" />
import { GIFEncoder, applyPalette, quantize, type GifPalette } from 'gifenc';

/**
 * GIF encoding worker.
 *
 * Palette quantisation and LZW compression are the two genuinely expensive
 * steps in a GIF export, so they run here instead of blocking the editor.
 * Frame pixels arrive as transferred ArrayBuffers — no copies.
 */

type Request =
  | {
      type: 'begin';
      width: number;
      height: number;
      maxColors: number;
      transparent: boolean;
    }
  | { type: 'frame'; pixels: ArrayBuffer; delayMs: number }
  | { type: 'finish' }
  | { type: 'abort' };

type Response =
  | { type: 'frame-done'; pixels: ArrayBuffer }
  | { type: 'result'; bytes: ArrayBuffer }
  | { type: 'error'; message: string };

let encoder: ReturnType<typeof GIFEncoder> | null = null;
let width = 0;
let height = 0;
let maxColors = 256;
let transparent = false;
let firstFrame = true;

function post(message: Response, transfer?: Transferable[]): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer ?? []);
}

function transparentIndexOf(palette: GifPalette): number {
  for (let i = 0; i < palette.length; i += 1) {
    if (palette[i].length >= 4 && palette[i][3] === 0) return i;
  }
  return -1;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'begin': {
        encoder = GIFEncoder();
        width = message.width;
        height = message.height;
        maxColors = Math.max(2, Math.min(256, message.maxColors));
        transparent = message.transparent;
        firstFrame = true;
        break;
      }
      case 'frame': {
        if (!encoder) throw new Error('GIF encoder was not initialised.');
        const pixels = new Uint8ClampedArray(message.pixels);
        const format = transparent ? 'rgba4444' : 'rgb565';
        const palette = quantize(pixels, maxColors, {
          format,
          oneBitAlpha: transparent,
          clearAlpha: transparent,
          clearAlphaThreshold: 128,
        });
        const indexed = applyPalette(pixels, palette, format);
        const transparentIndex = transparent ? transparentIndexOf(palette) : -1;
        encoder.writeFrame(indexed, width, height, {
          palette,
          delay: message.delayMs,
          repeat: 0,
          first: firstFrame,
          transparent: transparentIndex >= 0,
          transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
          dispose: transparentIndex >= 0 ? 2 : -1,
        });
        firstFrame = false;
        // Hand the buffer back so the caller can reuse it for the next frame.
        post({ type: 'frame-done', pixels: message.pixels }, [message.pixels]);
        break;
      }
      case 'finish': {
        if (!encoder) throw new Error('GIF encoder was not initialised.');
        encoder.finish();
        const bytes = encoder.bytes();
        encoder = null;
        const buffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buffer).set(bytes);
        post({ type: 'result', bytes: buffer }, [buffer]);
        break;
      }
      case 'abort': {
        encoder = null;
        break;
      }
    }
  } catch (error) {
    encoder = null;
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
