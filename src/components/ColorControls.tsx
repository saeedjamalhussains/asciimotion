import { COLOR_MODES } from '../state/settings';
import type { ColorMode, EditorSettings } from '../types';
import { cn } from '@/lib/utils';
import { isValidHex, normalizeHex } from '../utils/color';
import { LabeledSwitch } from './controls/LabeledSwitch';

interface ColorControlsProps {
  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="am-swatch shrink-0"
      />
      <input
        aria-label={`${label} hex value`}
        value={value}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value;
          if (isValidHex(next)) onChange(normalizeHex(next));
          else onChange(next.startsWith('#') ? next : `#${next}`);
        }}
        onBlur={(event) => {
          if (!isValidHex(event.target.value)) onChange(value);
        }}
        className="h-7 w-full min-w-0 rounded-md bg-fill px-2.5 font-mono text-footnote text-foreground pointer-coarse:h-10"
      />
    </div>
  );
}

export function ColorControls({ settings, onChange }: ColorControlsProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {COLOR_MODES.map((mode) => {
          const active = settings.colorMode === mode.id && !settings.gradient;
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ colorMode: mode.id as ColorMode, gradient: false })}
              className={cn(
                'press flex flex-col items-center gap-1 rounded-lg px-1 py-2',
                active ? 'bg-primary/25 ring-1 ring-tint ring-inset' : 'bg-fill hover:bg-muted',
              )}
            >
              <span
                aria-hidden="true"
                className="size-4 rounded-full shadow-[0_0_0_0.5px_rgb(255_255_255/0.25)]"
                style={{ background: mode.id === 'custom' ? settings.customColor : mode.swatch }}
              />
              <span className="text-footnote text-foreground">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {settings.colorMode === 'custom' && !settings.gradient && (
        <ColorField
          label="Custom colour"
          value={settings.customColor}
          onChange={(customColor) => onChange({ customColor })}
        />
      )}

      <LabeledSwitch
        label="Gradient"
        checked={settings.gradient}
        onChange={(gradient) => onChange({ gradient })}
      />

      {settings.gradient && (
        <div className="grid gap-2">
          <ColorField
            label="Gradient start"
            value={settings.gradientFrom}
            onChange={(gradientFrom) => onChange({ gradientFrom })}
          />
          <ColorField
            label="Gradient end"
            value={settings.gradientTo}
            onChange={(gradientTo) => onChange({ gradientTo })}
          />
        </div>
      )}
    </>
  );
}
