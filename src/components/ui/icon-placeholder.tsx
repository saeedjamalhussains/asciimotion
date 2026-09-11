import type { ComponentProps } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';

/**
 * shadcn's registry components reference icons through an `IconPlaceholder`
 * that names the same glyph across several icon libraries. This project uses
 * Lucide, so only that prop is read.
 *
 * The map is explicit rather than a namespace import so the bundler can drop
 * every icon we do not use.
 */
const LUCIDE = {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
} as const;

type LucideName = keyof typeof LUCIDE;

interface IconPlaceholderProps extends ComponentProps<'svg'> {
  lucide: LucideName;
  /** Names for the other icon sets shadcn supports; unused here. */
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}

export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: IconPlaceholderProps) {
  const Icon = LUCIDE[lucide] ?? CheckIcon;
  return <Icon {...props} />;
}
