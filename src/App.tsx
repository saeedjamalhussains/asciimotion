import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorShell } from './components/EditorShell';
import { useLocalFile } from './hooks/useLocalFile';
import { DEFAULT_EXPORT_SETTINGS, DEFAULT_SETTINGS } from './state/settings';
import type { EditorSettings, ExportSettings } from './types';

/**
 * ASCII Motion — a single-screen editor.
 *
 * The demo clip is loaded on first paint so the app opens on something to
 * look at, exactly as it behaves once a real video is dropped in.
 */
export function App() {
  const { media, loading, error, openFile, openDemo, clear, dismissError } = useLocalFile();
  const seeded = useRef(false);
  // The editor remounts for each clip, to reset its timeline and export. The look
  // the user has tuned lives out here, so it carries over to the next clip.
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [resetFrom, setResetFrom] = useState<EditorSettings | null>(null);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    openDemo();
  }, [openDemo]);

  // Warn before a reload would discard the in-memory clip.
  useEffect(() => {
    if (!media || media.source.kind === 'demo') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [media]);

  const handleFile = useCallback(
    (file: File) => {
      void openFile(file);
    },
    [openFile],
  );

  return (
    <EditorShell
      key={media ? media.source.info.name + media.source.info.duration : 'empty'}
      source={media?.source ?? null}
      file={media?.file ?? null}
      loading={loading}
      loadError={error}
      onFile={handleFile}
      onDemo={openDemo}
      onRemove={clear}
      onDismissError={dismissError}
      settings={settings}
      onSettingsChange={setSettings}
      exportSettings={exportSettings}
      onExportSettingsChange={setExportSettings}
      resetFrom={resetFrom}
      onResetFromChange={setResetFrom}
    />
  );
}
