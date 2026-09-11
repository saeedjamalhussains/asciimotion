import { useId } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LabeledSelectProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  hint?: string;
  className?: string;
  onChange(value: T): void;
}

export function LabeledSelect<T extends string>({
  label,
  value,
  options,
  hint,
  className,
  onChange,
}: LabeledSelectProps<T>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block pb-2 text-[12.5px] text-fg-dim">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} size="sm" className="w-full text-[12.5px]">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-[12.5px]">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="pt-1.5 text-[11.5px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}
