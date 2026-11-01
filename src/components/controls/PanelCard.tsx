import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDownIcon, RestoreIcon } from '@/components/ui/Icons';
import { IconButton } from './IconButton';

interface PanelCardProps {
  title: string;
  /** Small value shown at the right of the header. */
  meta?: string;
  /** Present only while the section differs from its defaults. */
  onReset?(): void;
  collapsible?: boolean;
  children: ReactNode;
}

/**
 * A titled section of the control rail.
 *
 * Radix's Collapsible drives the disclosure and its ARIA wiring. The reset
 * control sits beside the trigger rather than inside it, and the chevron holds
 * its place whether or not a reset is on offer.
 */
export function PanelCard({ title, meta, onReset, collapsible = true, children }: PanelCardProps) {
  const heading = <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>;
  const metaLabel = meta && <span className="tabular shrink-0 text-footnote text-faint">{meta}</span>;
  const resetButton = onReset && (
    <IconButton label={`Reset ${title.toLowerCase()}`} size="sm" onClick={onReset}>
      <RestoreIcon />
    </IconButton>
  );
  const body = <div className="space-y-4 px-4 pt-1 pb-4">{children}</div>;

  if (!collapsible) {
    return (
      <section className="border-b border-border last:border-b-0">
        <header className="flex min-h-11 items-center gap-2 pr-2.5 pl-4">
          {heading}
          {metaLabel}
          {resetButton}
        </header>
        {body}
      </section>
    );
  }

  return (
    <Collapsible className="group/panel border-b border-border last:border-b-0" asChild>
      <section>
        <header className="relative">
          <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 pr-3.5 pl-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:-outline-offset-2">
            {heading}
            {metaLabel}
            {onReset && <span aria-hidden="true" className="w-6 shrink-0 pointer-coarse:w-9" />}
            <ChevronDownIcon
              width={14}
              height={14}
              className="shrink-0 -rotate-90 text-faint transition-transform duration-200 ease-apple group-data-[state=open]/panel:rotate-0"
            />
          </CollapsibleTrigger>
          {resetButton && (
            <span className="absolute top-1/2 right-8 -translate-y-1/2">{resetButton}</span>
          )}
        </header>
        <CollapsibleContent className="animate-disclose overflow-hidden">{body}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
