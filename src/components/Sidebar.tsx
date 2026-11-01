import type { UseExport } from '../hooks/useExport';
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
  onFile(file: File): void;
  onDemo(): void;
  onRemove(): void;

  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;

  exporter: UseExport;
  exportSettings: ExportSettings;
  onExportChange(patch: Partial<ExportSettings>): void;
}

export function Sidebar({
  source,
  loading,
  onFile,
  onDemo,
  onRemove,
  settings,
  onChange,
  exporter,
  exportSettings,
  onExportChange,
}: SidebarProps) {
  const activeEffects = Object.values(settings.effects).filter(Boolean).length;
  const fontId =
    FONT_OPTIONS.find((option) => option.stack === settings.fontFamily)?.id ?? FONT_OPTIONS[0].id;

  /** A section offers a reset only while it holds something to reset. */
  const resetFor = (keys: (keyof EditorSettings)[]) => {
    const modified = keys.some(
      (key) => JSON.stringify(settings[key]) !== JSON.stringify(DEFAULT_SETTINGS[key]),
    );
    if (!modified) return undefined;
    return () => {
      const patch: Partial<EditorSettings> = {};
      for (const key of keys) {
        // Index assignment across a heterogeneous record needs the cast.
        (patch as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
      }
      onChange(patch);
    };
  };

  return (
    <div>
      <SourceCard
        source={source}
        loading={loading}
        onFile={onFile}
        onDemo={onDemo}
        onRemove={onRemove}
      />

      <PanelCard
        title="Characters"
        collapsible={false}
        onReset={resetFor(['charset', 'charsetId', 'resolution'])}
      >
        <CharacterSelector settings={settings} onChange={onChange} />
      </PanelCard>

      <PanelCard
        title="Type"
        onReset={resetFor(['fontFamily', 'fontSize', 'letterSpacing', 'lineSpacing'])}
      >
        <LabeledSelect
          label="Font"
          value={fontId}
          options={FONT_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
          onChange={(id) => {
            const option = FONT_OPTIONS.find((item) => item.id === id);
            if (option) onChange({ fontFamily: option.stack });
          }}
        />
        <LabeledSlider
          label="Size"
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
      </PanelCard>

      <PanelCard
        title="Tone"
        onReset={resetFor(['brightness', 'contrast', 'gamma', 'exposure', 'sharpness', 'invert'])}
      >
        <ImageControls settings={settings} onChange={onChange} />
      </PanelCard>

      <PanelCard
        title="Colour"
        onReset={resetFor(['colorMode', 'customColor', 'gradient', 'gradientFrom', 'gradientTo'])}
      >
        <ColorControls settings={settings} onChange={onChange} />
      </PanelCard>

      <PanelCard title="Frame" onReset={resetFor(['aspectRatio', 'background'])}>
        <OptionGroup
          label="Aspect ratio"
          value={settings.aspectRatio}
          options={ASPECT_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
          onChange={(aspectRatio) => onChange({ aspectRatio: aspectRatio as AspectRatioId })}
        />
        <div>
          <OptionGroup
            label="Background"
            value={settings.background}
            options={BACKGROUND_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
            onChange={(background) => onChange({ background: background as BackgroundMode })}
          />
          {settings.background === 'transparent' && (
            <p className="pt-1.5 text-footnote text-muted-foreground">
              MP4 has no alpha channel, so it exports on black.
            </p>
          )}
        </div>
      </PanelCard>

      <PanelCard
        title="Effects"
        meta={activeEffects > 0 ? `${activeEffects} on` : undefined}
        onReset={resetFor(['effects'])}
      >
        <EffectsPanel settings={settings} onChange={onChange} />
      </PanelCard>

      <ExportCard
        exporter={exporter}
        exportSettings={exportSettings}
        onChange={onExportChange}
        hasAudio={source?.info.hasAudio ?? false}
        disabled={!source}
      />
    </div>
  );
}
