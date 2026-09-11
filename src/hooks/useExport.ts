import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EditorSettings,
  ExportProgressState,
  ExportResult,
  ExportSettings,
  TrimRange,
} from '../types';
import { downloadObjectUrl } from '../utils/fileHandling';
import { probeAllFormats, type FormatSupport } from '../video/codecSupport';
import { ExportCancelled, ExportError, planOutput, runExport } from '../video/exporter';
import type { FrameSource } from '../video/frameSource';
import type { ExportFormat } from '../types';

export interface ExportFailure {
  reason: string;
  hint: string;
}

const IDLE: ExportProgressState = {
  phase: 'idle',
  progress: 0,
  renderedSeconds: 0,
  totalSeconds: 0,
  message: '',
  etaSeconds: null,
};

export interface UseExport {
  state: ExportProgressState;
  result: ExportResult | null;
  error: ExportFailure | null;
  support: Record<ExportFormat, FormatSupport> | null;
  probing: boolean;
  outputSize: { width: number; height: number } | null;
  start(exportSettings: ExportSettings): Promise<void>;
  cancel(): void;
  reset(): void;
  download(): void;
}

/**
 * Orchestrates a local export and keeps its object URL alive only as long as
 * the result is on screen.
 */
export function useExport(
  source: FrameSource | null,
  file: File | null,
  settings: EditorSettings,
  exportSettings: ExportSettings,
  trim: TrimRange,
): UseExport {
  const [state, setState] = useState<ExportProgressState>(IDLE);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<ExportFailure | null>(null);
  const [support, setSupport] = useState<Record<ExportFormat, FormatSupport> | null>(null);
  const [probing, setProbing] = useState(false);
  const [outputSize, setOutputSize] = useState<{ width: number; height: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<ExportResult | null>(null);
  resultRef.current = result;

  // Work out the exported frame size for the current settings.
  useEffect(() => {
    if (!source) {
      setOutputSize(null);
      return;
    }
    try {
      setOutputSize(planOutput(settings, exportSettings, source.info.width, source.info.height));
    } catch {
      setOutputSize(null);
    }
  }, [source, settings, exportSettings]);

  // Probe encoders whenever the target size or frame rate changes.
  useEffect(() => {
    if (!source || !outputSize) return;
    let cancelled = false;
    setProbing(true);
    probeAllFormats(outputSize.width, outputSize.height, exportSettings.fps)
      .then((probed) => {
        if (!cancelled) setSupport(probed);
      })
      .catch(() => {
        if (!cancelled) setSupport(null);
      })
      .finally(() => {
        if (!cancelled) setProbing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, outputSize, exportSettings.fps]);

  const releaseResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current.url);
      resultRef.current = null;
    }
    setResult(null);
  }, []);

  useEffect(() => releaseResult, [releaseResult]);

  const start = useCallback(
    async (currentExportSettings: ExportSettings) => {
      if (!source) return;
      const formatSupport = support?.[currentExportSettings.format];
      if (!formatSupport || !formatSupport.available) {
        setError({
          reason: 'Your browser cannot encode this format.',
          hint:
            formatSupport?.note ??
            'Try WebM, or open ASCII Motion in Chrome or Edge for the widest codec support.',
        });
        setState({ ...IDLE, phase: 'error' });
        return;
      }

      releaseResult();
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;
      const plan = planOutput(settings, currentExportSettings, source.info.width, source.info.height);
      setOutputSize(plan);
      setState({
        ...IDLE,
        phase: 'preparing',
        totalSeconds: trim.end - trim.start,
        message: 'Preparing the encoder…',
      });

      try {
        const exported = await runExport({
          source,
          file,
          settings,
          exportSettings: currentExportSettings,
          support: formatSupport,
          trim,
          signal: controller.signal,
          onProgress: setState,
        });
        resultRef.current = exported;
        setResult(exported);
        setState({
          phase: 'done',
          progress: 1,
          renderedSeconds: exported.durationSeconds,
          totalSeconds: exported.durationSeconds,
          message: 'Your ASCII video is ready.',
          etaSeconds: 0,
        });
      } catch (caught) {
        if (caught instanceof ExportCancelled || controller.signal.aborted) {
          setState({ ...IDLE, phase: 'cancelled', message: 'Export cancelled.' });
          return;
        }
        if (caught instanceof ExportError) {
          setError({ reason: caught.message, hint: caught.hint });
        } else {
          setError({
            reason: 'Something went wrong while exporting.',
            hint: caught instanceof Error ? caught.message : 'Try a smaller size or a shorter range.',
          });
        }
        setState({ ...IDLE, phase: 'error' });
      } finally {
        abortRef.current = null;
      }
    },
    [source, file, settings, trim, support, releaseResult],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    releaseResult();
    setError(null);
    setState(IDLE);
  }, [releaseResult]);

  const download = useCallback(() => {
    if (!resultRef.current) return;
    downloadObjectUrl(resultRef.current.url, resultRef.current.filename);
  }, []);

  return { state, result, error, support, probing, outputSize, start, cancel, reset, download };
}
