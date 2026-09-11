import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IconButtonProps extends Omit<ComponentProps<typeof Button>, 'size' | 'variant'> {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const SIZES = { sm: 'icon-xs', md: 'icon-sm', lg: 'icon' } as const;

/** Square icon control with a tooltip carrying its accessible name. */
export function IconButton({
  label,
  active,
  size = 'md',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={SIZES[size]}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'text-muted-foreground hover:text-foreground',
            active && 'bg-primary/15 text-primary hover:text-primary',
            className,
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
