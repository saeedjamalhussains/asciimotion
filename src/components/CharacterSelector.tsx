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
      <div>
        <div className="pb-2 text-[12.5px] text-fg-dim">Character set</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((preset) => {
            const active = settings.charsetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                aria-pressed={active}
                onClick={() => onChange({ charsetId: preset.id, charset: preset.ramp })}
                className={cn(
                  'rounded-[8px] border px-2.5 py-2 text-left transition-colors duration-150',
                  active
                    ? 'border-primary/45 bg-primary-subtle/60'
                    : 'border-border bg-background hover:border-input hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'block text-[11.5px] font-medium',
                    active ? 'text-primary' : 'text-fg-dim',
                  )}
                >
                  {preset.label}
                </span>
                <span className="mt-1 block truncate font-mono text-[11px] text-faint">
                  {rampPreview(preset.ramp, 12)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="custom-ramp"
          className="flex items-baseline justify-between gap-3 pb-1.5 text-[12.5px] text-fg-dim"
        >
          Custom ramp
          <span className="eyebrow">densest first</span>
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
            'h-9 w-full rounded-[8px] border bg-background px-3 font-mono text-[13px] text-foreground',
            'transition-colors placeholder:text-faint',
            settings.charsetId === 'custom' ? 'border-primary/45' : 'border-border hover:border-input',
          )}
        />
        <p className="pt-1 text-[11.5px] leading-snug text-faint">
          {Array.from(settings.charset).length} glyphs in the active ramp.
        </p>
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
        hint="Higher values keep more detail and cost more per frame."
      />
    </>
  );
}
