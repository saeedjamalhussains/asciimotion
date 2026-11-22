import { useCallback, useRef, useState } from 'react';
import baseClipUrl from '../assets/base.mp4?url';
import { createDemoSource } from '../video/demoSource';
import type { FrameSource } from '../video/frameSource';
import { loadGifFile } from '../video/gifSource';
import { loadVideoFile, MediaLoadError } from '../video/videoLoader';
import { validateFile } from '../utils/fileHandling';

export interface LoadedMedia {
  source: FrameSource;
  /** Kept only so audio can be decoded locally at export time. */
  file: File | null;
}

export interface LoadFailure {
  reason: string;
  hint: string;
}

export interface UseLocalFile {
  media: LoadedMedia | null;
  loading: boolean;
  error: LoadFailure | null;
  openFile(file: File): Promise<void>;
  openDemo(): Promise<void>;
  clear(): void;
  dismissError(): void;
}

const BASE_CLIP_NAME = 'base.mp4';

/**
 * The bundled default clip, as a `File` so it goes through exactly the same
 * path as a user's video — including local audio decoding at export time.
 */
async function loadBaseClip(): Promise<{ source: FrameSource; file: File }> {
  const response = await fetch(baseClipUrl);
  if (!response.ok) throw new Error(`Default clip request failed (${response.status}).`);
  const blob = await response.blob();
  const file = new File([blob], BASE_CLIP_NAME, { type: 'video/mp4' });
  const source = await loadVideoFile(file, true);
  return { source, file };
}

/**
 * Owns the lifetime of the decoded media. Object URLs and decoder resources
 * are released whenever the source is replaced or cleared, so nothing lingers
 * after the user removes a video.
 */
export function useLocalFile(): UseLocalFile {
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadFailure | null>(null);
  const currentRef = useRef<FrameSource | null>(null);
  /** Bumped per load, so a slow load cannot replace one that started later. */
  const requestRef = useRef(0);

  const replace = useCallback((next: LoadedMedia | null) => {
    if (currentRef.current) currentRef.current.dispose();
    currentRef.current = next?.source ?? null;
    setMedia(next);
  }, []);

  /** Runs `load`, keeping its result only if no newer request has started. */
  const runLoad = useCallback(
    async (load: () => Promise<LoadedMedia>) => {
      const request = ++requestRef.current;
      setError(null);
      setLoading(true);
      try {
        const next = await load();
        if (request !== requestRef.current) {
          next.source.dispose();
          return;
        }
        replace(next);
      } catch (caught) {
        if (request !== requestRef.current) return;
        if (caught instanceof MediaLoadError) {
          setError({ reason: caught.message, hint: caught.hint });
        } else {
          setError({
            reason: 'That file could not be opened.',
            hint: caught instanceof Error ? caught.message : 'Try a different video.',
          });
        }
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [replace],
  );

  const openFile = useCallback(
    async (file: File) => {
      const rejection = validateFile(file);
      if (rejection) {
        setError(rejection);
        return;
      }
      await runLoad(async () => {
        const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
        const source = isGif ? await loadGifFile(file) : await loadVideoFile(file);
        return { source, file };
      });
    },
    [runLoad],
  );

  const openDemo = useCallback(
    () =>
      runLoad(async () => {
        try {
          return await loadBaseClip();
        } catch {
          // Falls back to the procedural clip, which needs no network or decoder.
          return { source: createDemoSource(), file: null };
        }
      }),
    [runLoad],
  );

  const clear = useCallback(() => {
    requestRef.current += 1;
    setLoading(false);
    replace(null);
    setError(null);
  }, [replace]);

  const dismissError = useCallback(() => setError(null), []);

  return { media, loading, error, openFile, openDemo, clear, dismissError };
}
