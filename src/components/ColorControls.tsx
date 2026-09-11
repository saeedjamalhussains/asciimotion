import { BACKGROUND_MODES, COLOR_MODES } from '../state/settings';
import type { BackgroundMode, ColorMode, EditorSettings } from '../types';
import { cn } from '@/lib/utils';
import { isValidHex, normalizeHex } from '../utils/color';
import { OptionGroup } from './controls/OptionGroup';
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
    <label className="flex items-center gap-2.5">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="am-swatch shrink-0"
      />
      <span className="sr-only">{label}</span>
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
        className="h-8 w-full min-w-0 rounded-[7px] border border-border bg-background px-2.5 font-mono text-[12px] text-foreground transition-colors hover:border-input"
      />
    </label>
  );
}

export function ColorControls({ settings, onChange }: ColorControlsProps) {
  return (
    <>
      <div>
        <div className="pb-2 text-[12.5px] text-fg-dim">Colour mode</div>
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
                  'flex flex-col items-center gap-1.5 rounded-[8px] border px-1 py-2 transition-colors duration-150',
                  active
                    ? 'border-primary/45 bg-primary-subtle/60'
                    : 'border-border bg-background hover:border-input hover:bg-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border border-black/40"
                  style={{
                    background:
                      mode.id === 'custom'
                        ? settings.customColor
                        : mode.swatch.startsWith('linear')
                          ? mode.swatch
                          : mode.swatch,
                  }}
                />
                <span className={cn('text-[11px]', active ? 'text-primary' : 'text-muted-foreground')}>
                  {mode.label}
                </span>
              </button>
            );
          })}
        </div>
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
        description="Blend two colours across the frame instead of a flat tint."
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

      <div>
        <div className="pb-2 text-[12.5px] text-fg-dim">Background</div>
        <OptionGroup
          label="Background"
          size="sm"
          value={settings.background}
          options={BACKGROUND_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
          onChange={(background) => onChange({ background: background as BackgroundMode })}
        />
        {settings.background === 'transparent' && (
          <p className="pt-1.5 text-[11.5px] leading-snug text-faint">
            Alpha survives GIF and WebM export. MP4 has no alpha channel and will fall back to
            black.
          </p>
        )}
        {settings.background === 'white' && (
          <p className="pt-1.5 text-[11.5px] leading-snug text-faint">
            On a light background the ramp flips, so dark areas get the heavy glyphs.
          </p>
        )}
      </div>
    </>
  );
}
