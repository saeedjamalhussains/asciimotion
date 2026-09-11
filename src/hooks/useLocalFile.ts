import { useCallback, useRef, useState } from 'react';
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
  openDemo(): void;
  clear(): void;
  dismissError(): void;
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

  const replace = useCallback((next: LoadedMedia | null) => {
    if (currentRef.current) currentRef.current.dispose();
    currentRef.current = next?.source ?? null;
    setMedia(next);
  }, []);

  const openFile = useCallback(
    async (file: File) => {
      const rejection = validateFile(file);
      if (rejection) {
        setError(rejection);
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
        const source = isGif ? await loadGifFile(file) : await loadVideoFile(file);
        replace({ source, file });
      } catch (caught) {
        if (caught instanceof MediaLoadError) {
          setError({ reason: caught.message, hint: caught.hint });
        } else {
          setError({
            reason: 'That file could not be opened.',
            hint: caught instanceof Error ? caught.message : 'Try a different video.',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [replace],
  );

  const openDemo = useCallback(() => {
    setError(null);
    replace({ source: createDemoSource(), file: null });
  }, [replace]);

  const clear = useCallback(() => {
    replace(null);
    setError(null);
  }, [replace]);

  const dismissError = useCallback(() => setError(null), []);

  return { media, loading, error, openFile, openDemo, clear, dismissError };
}
