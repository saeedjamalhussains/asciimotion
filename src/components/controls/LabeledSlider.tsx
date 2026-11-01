import { useId } from 'react';
import { Slider } from '@/components/ui/slider';

interface LabeledSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Formatted read-out, e.g. `120 columns`. */
  display?: string;
  defaultValue?: number;
  onChange(value: number): void;
}

/**
 * A shadcn Slider with the editor's label / value / reset affordance around it.
 *
 * Radix gives keyboard control, correct ARIA and pointer capture; this wrapper
 * adds the read-out and the "reset to default" control that appears once a
 * value has been moved.
 */
export function LabeledSlider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  defaultValue,
  onChange,
}: LabeledSliderProps) {
  const id = useId();
  const readout = display ?? `${Number.isInteger(value) ? value : value.toFixed(2)}`;
  const modified = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-6;

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3 pb-1">
        <label htmlFor={id} className="text-fg-dim">
          {label}
        </label>
        <div className="flex items-baseline gap-2">
          {modified && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="text-footnote text-tint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              Reset
            </button>
          )}
          <span className="tabular text-foreground">{readout}</span>
        </div>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        aria-label={label}
        aria-valuetext={readout}
        onValueChange={([next]) => onChange(next)}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
      />
    </div>
  );
}
