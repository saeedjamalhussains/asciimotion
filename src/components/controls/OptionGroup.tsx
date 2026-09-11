import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  sublabel?: string;
  title?: string;
  disabled?: boolean;
}

interface OptionGroupProps<T extends string | number> {
  label: string;
  value: T;
  options: Option<T>[];
  columns?: number;
  size?: 'sm' | 'md';
  className?: string;
  onChange(value: T): void;
}

/**
 * Single-select control built on Radix's toggle group, which handles roving
 * focus and arrow-key navigation. Values are carried as strings and mapped
 * back, so numeric options (frame rates, for instance) still work.
 */
export function OptionGroup<T extends string | number>({
  label,
  value,
  options,
  columns,
  size = 'md',
  className,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      aria-label={label}
      onValueChange={(next) => {
        if (!next) return; // Radix emits '' when the active item is re-pressed.
        const match = options.find((option) => String(option.value) === next);
        if (match) onChange(match.value);
      }}
      className={cn(
        'grid w-full gap-1 rounded-lg border border-border bg-background p-1',
        !columns && 'auto-cols-fr grid-flow-col',
        className,
      )}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={String(option.value)}
          value={String(option.value)}
          title={option.title}
          disabled={option.disabled}
          className={cn(
            'h-auto min-w-0 flex-col gap-0 rounded-md border-0 text-muted-foreground',
            'data-[state=on]:bg-accent data-[state=on]:text-foreground',
            size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5',
          )}
        >
          <span className={cn('block truncate', size === 'sm' ? 'text-[11.5px]' : 'text-[12.5px]')}>
            {option.label}
          </span>
          {option.sublabel && (
            <span className="mt-0.5 block truncate font-mono text-[9.5px] tracking-wide text-faint uppercase">
              {option.sublabel}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
