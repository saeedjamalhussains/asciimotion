import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from '@/components/ui/Icons';

interface PanelCardProps {
  title: string;
  /** Small value shown at the right of the header. */
  meta?: string;
  onReset?(): void;
  resetLabel?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A titled section of the control rail.
 *
 * Radix's Collapsible drives the disclosure, which brings the correct ARIA
 * wiring and the enter/exit animation the shadcn styles expect.
 */
export function PanelCard({
  title,
  meta,
  onReset,
  resetLabel,
  collapsible = true,
  defaultOpen = true,
  className,
  children,
}: PanelCardProps) {
  const header = (
    <>
      <span className="panel-heading flex-1 truncate text-left">{title}</span>
      {meta && (
        <span className="tabular shrink-0 font-mono text-[10.5px] text-faint">{meta}</span>
      )}
    </>
  );

  const resetButton = onReset && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onReset}
          aria-label={resetLabel ?? `Reset ${title.toLowerCase()}`}
          className="shrink-0 text-faint hover:text-fg-dim"
        >
          <RotateCcw />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{resetLabel ?? `Reset ${title.toLowerCase()}`}</TooltipContent>
    </Tooltip>
  );

  const body = (
    <div className="space-y-3.5 border-t border-border px-3 pt-3 pb-3.5">{children}</div>
  );

  if (!collapsible) {
    return (
      <section className={cn('overflow-hidden rounded-lg bg-card', className)}>
        <header className="flex items-center gap-2 py-2.5 pr-1.5 pl-3">
          {header}
          {resetButton}
        </header>
        {body}
      </section>
    );
  }

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        'group/panel overflow-hidden rounded-lg bg-card',
        className,
      )}
      asChild
    >
      <section>
        <header className="flex items-center gap-2 pr-1.5 pl-3">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left outline-none">
            {header}
            <ChevronDownIcon
              width={13}
              height={13}
              className="shrink-0 text-faint transition-transform duration-200 group-data-[state=open]/panel:rotate-180"
            />
          </CollapsibleTrigger>
          {resetButton}
        </header>
        <CollapsibleContent>{body}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
