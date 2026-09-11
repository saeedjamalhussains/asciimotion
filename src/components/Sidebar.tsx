import type { UseExport } from '../hooks/useExport';
import type { LoadFailure } from '../hooks/useLocalFile';
import {
  ASPECT_PRESETS,
  BACKGROUND_MODES,
  DEFAULT_SETTINGS,
  FONT_OPTIONS,
} from '../state/settings';
import type {
  AspectRatioId,
  BackgroundMode,
  EditorSettings,
  ExportSettings,
  TrimRange,
} from '../types';
import type { FrameSource } from '../video/frameSource';
import { CharacterSelector } from './CharacterSelector';
import { ColorControls } from './ColorControls';
import { EffectsPanel } from './EffectsPanel';
import { ExportCard } from './ExportCard';
import { ImageControls } from './ImageControls';
import { SourceCard } from './SourceCard';
import { PanelCard } from './controls/PanelCard';
import { OptionGroup } from './controls/OptionGroup';
import { LabeledSelect } from './controls/LabeledSelect';
import { LabeledSlider } from './controls/LabeledSlider';

interface SidebarProps {
  source: FrameSource | null;
  loading: boolean;
  loadError: LoadFailure | null;
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;
  onDismissError(): void;

  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;

  exporter: UseExport;
  exportSettings: ExportSettings;
  onExportChange(patch: Partial<ExportSettings>): void;
  trim: TrimRange;
}

/** Restores a subset of the editor settings to their defaults. */
function resetKeys(keys: (keyof EditorSettings)[]): Partial<EditorSettings> {
  const patch: Partial<EditorSettings> = {};
  for (const key of keys) {
    // Index assignment across a heterogeneous record needs the cast.
    (patch as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
  }
  return patch;
}

export function Sidebar({
  source,
  loading,
  loadError,
  onFile,
  onDemo,
  onRemove,
  onDismissError,
  settings,
  onChange,
  exporter,
  exportSettings,
  onExportChange,
  trim,
}: SidebarProps) {
  const activeEffects = Object.values(settings.effects).filter(Boolean).length;
  const fontId =
    FONT_OPTIONS.find((option) => option.stack === settings.fontFamily)?.id ?? FONT_OPTIONS[0].id;

  return (
    <div className="space-y-2">
      <SourceCard
        source={source}
        loading={loading}
        error={loadError}
        onFile={onFile}
        onDemo={onDemo}
        onRemove={onRemove}
        onDismissError={onDismissError}
      />

      <PanelCard
        title="Character ramp"
        meta={`${Array.from(settings.charset).length}`}
        onReset={() => onChange(resetKeys(['charset', 'charsetId']))}
      >
        <CharacterSelector settings={settings} onChange={onChange} />
      </PanelCard>

      <PanelCard
        title="Sampling"
        meta={`${settings.resolution}`}
        onReset={() =>
          onChange(resetKeys(['resolution', 'fontFamily', 'fontSize', 'letterSpacing', 'lineSpacing']))
        }
      >
        <LabeledSlider
          label="Font size"
          value={settings.fontSize}
          min={6}
          max={28}
          step={1}
          display={`${settings.fontSize} px`}
          defaultValue={DEFAULT_SETTINGS.fontSize}
          onChange={(fontSize) => onChange({ fontSize })}
        />
        <LabeledSlider
          label="Character spacing"
          value={settings.letterSpacing}
          min={-0.3}
          max={0.6}
          step={0.01}
          display={settings.letterSpacing.toFixed(2)}
          defaultValue={DEFAULT_SETTINGS.letterSpacing}
          onChange={(letterSpacing) => onChange({ letterSpacing })}
        />
        <LabeledSlider
          label="Line spacing"
          value={settings.lineSpacing}
          min={0.8}
          max={1.6}
          step={0.01}
          display={`${settings.lineSpacing.toFixed(2)}×`}
          defaultValue={DEFAULT_SETTINGS.lineSpacing}
          onChange={(lineSpacing) => onChange({ lineSpacing })}
        />
        <LabeledSelect
          label="Font"
          hint="Apple's monospace faces, read from your system. Other platforms fall back to their own."
          value={fontId}
          options={FONT_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
          onChange={(id) => {
            const option = FONT_OPTIONS.find((item) => item.id === id);
            if (option) onChange({ fontFamily: option.stack });
          }}
        />
      </PanelCard>

      <PanelCard
        title="Tone"
        onReset={() =>
          onChange(resetKeys(['brightness', 'contrast', 'gamma', 'exposure', 'sharpness', 'invert']))
        }
      >
        <ImageControls settings={settings} onChange={onChange} />
      </PanelCard>

      <PanelCard
        title="Colour"
        onReset={() =>
          onChange(
            resetKeys(['colorMode', 'customColor', 'gradient', 'gradientFrom', 'gradientTo']),
          )
        }
      >
        <ColorControls settings={settings} onChange={onChange} />
      </PanelCard>

      <PanelCard title="Frame" onReset={() => onChange(resetKeys(['aspectRatio', 'background']))}>
        <div>
          <div className="pb-1.5 text-[12.5px] text-fg-dim">Aspect ratio</div>
          <OptionGroup
            label="Aspect ratio"
            size="sm"
            columns={3}
            value={settings.aspectRatio}
            options={ASPECT_PRESETS.map((preset) => ({
              value: preset.id,
              label: preset.label,
              sublabel: preset.usage,
            }))}
            onChange={(aspectRatio) => onChange({ aspectRatio: aspectRatio as AspectRatioId })}
          />
        </div>
        <div>
          <div className="pb-1.5 text-[12.5px] text-fg-dim">Background</div>
          <OptionGroup
            label="Background"
            size="sm"
            value={settings.background}
            options={BACKGROUND_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
            onChange={(background) => onChange({ background: background as BackgroundMode })}
          />
        </div>
      </PanelCard>

      <PanelCard
        title="Effects"
        meta={activeEffects > 0 ? `${activeEffects} on` : undefined}
        defaultOpen={false}
        onReset={() => onChange(resetKeys(['effects']))}
      >
        <EffectsPanel settings={settings} onChange={onChange} />
      </PanelCard>

      <ExportCard
        exporter={exporter}
        exportSettings={exportSettings}
        onChange={onExportChange}
        trim={trim}
        hasAudio={source?.info.hasAudio ?? false}
        disabled={!source}
      />
    </div>
  );
}
