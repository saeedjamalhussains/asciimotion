import { EFFECT_META } from '../state/settings';
import type { EditorSettings } from '../types';
import { LabeledSwitch } from './controls/LabeledSwitch';

interface EffectsPanelProps {
  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;
}

export function EffectsPanel({ settings, onChange }: EffectsPanelProps) {
  const active = Object.values(settings.effects).filter(Boolean).length;

  return (
    <>
      <div className="-mt-1 space-y-0.5">
        {EFFECT_META.map((effect) => (
          <LabeledSwitch
            key={effect.id}
            label={effect.label}
            description={effect.description}
            checked={settings.effects[effect.id]}
            onChange={(value) => onChange({ effects: { ...settings.effects, [effect.id]: value } })}
          />
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed text-faint">
        Effects are driven by the frame number, so the exported file matches the preview frame for
        frame. Only <span className="text-fg-dim">Flicker</span> varies brightness between frames by
        design.
      </p>

      {active > 0 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              effects: {
                crt: false,
                scanlines: false,
                vhs: false,
                noise: false,
                flicker: false,
                glitch: false,
                glow: false,
                matrix: false,
                dither: false,
              },
            })
          }
          className="text-[12px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Turn off all {active} effect{active === 1 ? '' : 's'}
        </button>
      )}
    </>
  );
}
