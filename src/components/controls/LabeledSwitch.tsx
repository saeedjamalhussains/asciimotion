import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface LabeledSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}

export function LabeledSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: LabeledSwitchProps) {
  const id = useId();
  return (
    <div
      className={cn(
        '-mx-2.5 flex items-start justify-between gap-3 rounded-md px-2.5 py-2 transition-colors',
        !disabled && 'hover:bg-muted',
        disabled && 'opacity-45',
      )}
    >
      <label htmlFor={id} className={cn('min-w-0 flex-1', !disabled && 'cursor-pointer')}>
        <span className="block text-[12.5px] text-foreground">{label}</span>
        {description && (
          <span className="block pt-0.5 text-[11.5px] leading-snug text-faint">{description}</span>
        )}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
