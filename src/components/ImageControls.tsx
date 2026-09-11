import { DEFAULT_SETTINGS } from '../state/settings';
import type { EditorSettings } from '../types';
import { LabeledSlider } from './controls/LabeledSlider';
import { LabeledSwitch } from './controls/LabeledSwitch';

interface ImageControlsProps {
  settings: EditorSettings;
  onChange(patch: Partial<EditorSettings>): void;
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;

export function ImageControls({ settings, onChange }: ImageControlsProps) {
  return (
    <>
      <LabeledSlider
        label="Brightness"
        value={settings.brightness}
        min={-100}
        max={100}
        step={1}
        display={signed(settings.brightness)}
        defaultValue={DEFAULT_SETTINGS.brightness}
        onChange={(brightness) => onChange({ brightness })}
      />
      <LabeledSlider
        label="Contrast"
        value={settings.contrast}
        min={-100}
        max={100}
        step={1}
        display={signed(settings.contrast)}
        defaultValue={DEFAULT_SETTINGS.contrast}
        onChange={(contrast) => onChange({ contrast })}
      />
      <LabeledSlider
        label="Gamma"
        value={settings.gamma}
        min={0.5}
        max={2}
        step={0.01}
        display={settings.gamma.toFixed(2)}
        defaultValue={DEFAULT_SETTINGS.gamma}
        onChange={(gamma) => onChange({ gamma })}
        hint="Above 1 lifts mid-tones; below 1 deepens them."
      />
      <LabeledSlider
        label="Exposure"
        value={settings.exposure}
        min={-100}
        max={100}
        step={1}
        display={`${signed(settings.exposure)} EV·⅓`}
        defaultValue={DEFAULT_SETTINGS.exposure}
        onChange={(exposure) => onChange({ exposure })}
      />
      <LabeledSlider
        label="Sharpness"
        value={settings.sharpness}
        min={0}
        max={100}
        step={1}
        display={`${settings.sharpness}%`}
        defaultValue={DEFAULT_SETTINGS.sharpness}
        onChange={(sharpness) => onChange({ sharpness })}
        hint="Unsharp mask applied to the character grid before mapping."
      />
      <LabeledSwitch
        label="Invert"
        description="Flip light and dark before the ramp is applied."
        checked={settings.invert}
        onChange={(invert) => onChange({ invert })}
      />
    </>
  );
}
