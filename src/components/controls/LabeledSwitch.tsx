import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface LabeledSwitchProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}

export function LabeledSwitch({ label, checked, disabled, onChange }: LabeledSwitchProps) {
  const id = useId();
  return (
    <div
      className={cn(
        'flex min-h-7 items-center justify-between gap-3 pointer-coarse:min-h-11',
        disabled && 'opacity-40',
      )}
    >
      <label htmlFor={id} className={cn('min-w-0 flex-1 text-fg-dim', !disabled && 'cursor-pointer')}>
        {label}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
