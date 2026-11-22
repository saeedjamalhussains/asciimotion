import type { ReactNode } from 'react';
import type { UseExport } from '../hooks/useExport';
import type { TimelineState } from '../hooks/useTimeline';
import type { VideoTransport } from '../hooks/useVideo';
import {
  ASPECT_PRESETS,
  BACKGROUND_MODES,
  DEFAULT_SETTINGS,
  FONT_OPTIONS,
} from '../state/settings';
import type { AspectRatioId, BackgroundMode, EditorSettings, ExportSettings } from '../types';
import type { FrameSource } from '../video/frameSource';
import { CharacterSelector } from './CharacterSelector';
import { ColorControls } from './ColorControls';
import { EffectsPanel } from './EffectsPanel';
import { ExportCard } from './ExportCard';
import { ImageControls } from './ImageControls';
import { SourceCard } from './SourceCard';
import { TrimControls } from './TrimControls';
import { IconButton } from './controls/IconButton';
import { LabeledSelect } from './controls/LabeledSelect';
import { LabeledSlider } from './controls/LabeledSlider';
import { OptionGroup } from './controls/OptionGroup';
import { TOOL_TITLES, type ToolId } from './tools';
import { RestoreIcon } from './ui/Icons';

export interface ToolPanelProps {
  tool: ToolId;
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

  timeline: TimelineState;
  transport: VideoTransport;

  /** Extra header controls, such as the phone drawer's Done button. */
  actions?: ReactNode;
}

/** Settings each tool owns, for its Reset control. */
const TOOL_KEYS: Partial<Record<ToolId, (keyof EditorSettings)[]>> = {
  characters: ['charset', 'charsetId', 'resolution'],
  type: ['fontFamily', 'fontSize', 'letterSpacing', 'lineSpacing'],
  tone: ['brightness', 'contrast', 'gamma', 'exposure', 'sharpness', 'invert'],
  colour: ['colorMode', 'customColor', 'gradient', 'gradientFrom', 'gradientTo'],
  frame: ['aspectRatio', 'background'],
  effects: ['effects'],
};

export function countActiveEffects(settings: EditorSettings): number {
  return Object.values(settings.effects).filter(Boolean).length;
}

/** One tool's controls under a plain heading. */
export function ToolPanel(props: ToolPanelProps) {
  const { tool, settings, onChange, actions } = props;

  const keys = TOOL_KEYS[tool];
  const modified =
    keys?.some((key) => JSON.stringify(settings[key]) !== JSON.stringify(DEFAULT_SETTINGS[key])) ??
    false;
  const reset = () => {
    if (!keys) return;
    const patch: Partial<EditorSettings> = {};
    for (const key of keys) {
      // Index assignment across a heterogeneous record needs the cast.
      (patch as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
    }
    onChange(patch);
  };

  return (
    <section aria-label={TOOL_TITLES[tool]} className="flex min-h-0 flex-col">
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-1 border-b border-border bg-card pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate label-micro font-semibold text-foreground">
          {TOOL_TITLES[tool]}
          {tool === 'effects' && countActiveEffects(settings) > 0 && (
            <span className="pl-2 text-tint">{countActiveEffects(settings)} on</span>
          )}
        </h2>
        {modified && (
          <IconButton label={`Reset ${TOOL_TITLES[tool].toLowerCase()}`} size="sm" onClick={reset}>
            <RestoreIcon />
          </IconButton>
        )}
        {actions}
      </header>
      <div className="space-y-4 p-4">
        <ToolBody {...props} />
      </div>
    </section>
  );
}

function ToolBody({
  tool,
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
  timeline,
  transport,
}: ToolPanelProps) {
  const fontId =
    FONT_OPTIONS.find((option) => option.stack === settings.fontFamily)?.id ?? FONT_OPTIONS[0].id;

  switch (tool) {
    case 'media':
      return (
        <SourceCard
          source={source}
          loading={loading}
          onFile={onFile}
          onDemo={onDemo}
          onRemove={onRemove}
        />
      );

    case 'trim':
      return (
        <>
          <p className="text-footnote text-muted-foreground">
            Drag the handles on the timeline, or set each end from the playhead.
          </p>
          <TrimControls
            trim={timeline.trim}
            trimmed={timeline.trimmed}
            getTime={transport.getTime}
            onSetStart={timeline.setStart}
            onSetEnd={timeline.setEnd}
            onReset={timeline.reset}
          />
        </>
      );

    case 'characters':
      return <CharacterSelector settings={settings} onChange={onChange} />;

    case 'type':
      return (
        <>
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
        </>
      );

    case 'tone':
      return <ImageControls settings={settings} onChange={onChange} />;

    case 'colour':
      return <ColorControls settings={settings} onChange={onChange} />;

    case 'frame':
      return (
        <>
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
        </>
      );

    case 'effects':
      return <EffectsPanel settings={settings} onChange={onChange} />;

    case 'export':
      return (
        <ExportCard
          exporter={exporter}
          exportSettings={exportSettings}
          onChange={onExportChange}
          hasAudio={source?.info.hasAudio ?? false}
          disabled={!source}
        />
      );
  }
}
