import { useId } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
}

interface OptionGroupProps<T extends string | number> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange(value: T): void;
}

/**
 * Segmented control built on Radix's toggle group, which handles roving focus
 * and arrow-key navigation. Values are carried as strings and mapped back, so
 * numeric options (frame rates, for instance) still work.
 *
 * Segments share one width, so the selection is a single thumb that slides
 * between them and can be redirected mid-way by pressing another segment.
 */
export function OptionGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: OptionGroupProps<T>) {
  const labelId = useId();
  const selected = options.findIndex((option) => option.value === value);

  return (
    <div>
      <div id={labelId} className="pb-1.5 text-fg-dim">
        {label}
      </div>
      <ToggleGroup
        type="single"
        value={String(value)}
        aria-labelledby={labelId}
        onValueChange={(next) => {
          if (!next) return; // Radix emits '' when the active item is re-pressed.
          const match = options.find((option) => String(option.value) === next);
          if (match) onChange(match.value);
        }}
        className="relative grid w-full auto-cols-fr grid-flow-col rounded-lg bg-fill p-0.5"
      >
        {selected >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0.5 left-0.5 rounded-md bg-white/20 shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-250 ease-apple"
            style={{
              width: `calc((100% - 0.25rem) / ${options.length})`,
              transform: `translateX(${selected * 100}%)`,
            }}
          />
        )}
        {options.map((option) => (
          <ToggleGroupItem
            key={String(option.value)}
            value={String(option.value)}
            title={option.title}
            disabled={option.disabled}
            className="relative h-6 min-w-0 px-1 text-muted-foreground hover:text-foreground data-[state=on]:text-foreground pointer-coarse:h-9"
          >
            <span className="block truncate">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
