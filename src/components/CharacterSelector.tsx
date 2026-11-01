import { useEffect, useState } from 'react';
import { rampPreview } from '../renderer/characterMapper';
import { CHARSET_PRESETS, RESOLUTION_STEPS } from '../state/settings';
import type { EditorSettings } from '../types';
import { cn } from '@/lib/utils';
import { LabeledSlider } from './controls/LabeledSlider';

interface CharacterSelectorProps {
  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;
}

const PRESETS = CHARSET_PRESETS.filter((preset) => preset.id !== 'custom');

export function CharacterSelector({ settings, onChange }: CharacterSelectorProps) {
  const [custom, setCustom] = useState(
    settings.charsetId === 'custom' ? settings.charset : '@%#*+=-:. ',
  );

  // Keep the custom field in sync when a project-level change swaps the ramp.
  useEffect(() => {
    if (settings.charsetId === 'custom') setCustom(settings.charset);
  }, [settings.charsetId, settings.charset]);

  const resolutionIndex = Math.max(
    0,
    RESOLUTION_STEPS.findIndex((step) => step >= settings.resolution),
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((preset) => {
          const active = settings.charsetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ charsetId: preset.id, charset: preset.ramp })}
              className={cn(
                'press rounded-lg px-2.5 py-1.5 text-left',
                active ? 'bg-primary/25 ring-1 ring-tint ring-inset' : 'bg-fill hover:bg-muted',
              )}
            >
              <span className="block font-medium text-foreground">{preset.label}</span>
              <span className="block truncate font-mono text-caption text-muted-foreground">
                {rampPreview(preset.ramp, 12)}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <label
          htmlFor="custom-ramp"
          className="flex items-baseline justify-between gap-3 pb-1.5 text-fg-dim"
        >
          Custom ramp
          <span className="text-footnote text-faint">Densest first</span>
        </label>
        <input
          id="custom-ramp"
          value={custom}
          spellCheck={false}
          autoComplete="off"
          placeholder="e.g. @%#*+=-:."
          onChange={(event) => {
            const value = event.target.value;
            setCustom(value);
            if (value.length > 0) onChange({ charsetId: 'custom', charset: value });
          }}
          onFocus={() => {
            if (custom.length > 0 && settings.charsetId !== 'custom') {
              onChange({ charsetId: 'custom', charset: custom });
            }
          }}
          className={cn(
            'h-8 w-full rounded-lg bg-fill px-2.5 font-mono text-footnote text-foreground transition-colors placeholder:text-muted-foreground pointer-coarse:h-11',
            settings.charsetId === 'custom' && 'bg-primary/25 ring-1 ring-tint ring-inset',
          )}
        />
      </div>

      <LabeledSlider
        label="Resolution"
        value={resolutionIndex}
        min={0}
        max={RESOLUTION_STEPS.length - 1}
        step={1}
        display={`${settings.resolution} columns`}
        defaultValue={RESOLUTION_STEPS.indexOf(120)}
        onChange={(index) => onChange({ resolution: RESOLUTION_STEPS[index] })}
      />
    </>
  );
}
