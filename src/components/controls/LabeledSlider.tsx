import { useId } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface LabeledSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Formatted read-out, e.g. `120 columns`. */
  display?: string;
  unit?: string;
  defaultValue?: number;
  hint?: string;
  disabled?: boolean;
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
  unit,
  defaultValue,
  hint,
  disabled,
  onChange,
}: LabeledSliderProps) {
  const id = useId();
  const readout = display ?? `${Number.isInteger(value) ? value : value.toFixed(2)}${unit ?? ''}`;
  const modified = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-6;

  return (
    <div className={cn('group', disabled && 'pointer-events-none opacity-45')}>
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <label htmlFor={id} className="text-[12.5px] text-fg-dim">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {modified && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="eyebrow opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg-dim focus-visible:opacity-100"
            >
              reset
            </button>
          )}
          <span className="tabular font-mono text-[12px] text-foreground">{readout}</span>
        </div>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={readout}
        onValueChange={([next]) => onChange(next)}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
      />
      {hint && <p className="pt-1.5 text-[11.5px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}
