import { EFFECT_META } from '../state/settings';
import type { EditorSettings } from '../types';
import { LabeledSwitch } from './controls/LabeledSwitch';

interface EffectsPanelProps {
  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;
}

export function EffectsPanel({ settings, onChange }: EffectsPanelProps) {
  return (
    <div className="-my-1 space-y-0.5">
      {EFFECT_META.map((effect) => (
        <LabeledSwitch
          key={effect.id}
          label={effect.label}
          checked={settings.effects[effect.id]}
          onChange={(value) => onChange({ effects: { ...settings.effects, [effect.id]: value } })}
        />
      ))}
    </div>
  );
}
