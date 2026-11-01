import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** The type scale in index.css; unregistered, `text-body` would read as a colour. */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['caption', 'footnote', 'body', 'title', 'display'] } },
});

/**
 * Joins class names and resolves Tailwind conflicts, last one winning.
 *
 * The conflict resolution matters: a component that sets its own `inline-flex`
 * would otherwise beat a `hidden` passed in by a caller, because Tailwind emits
 * both in the same layer and source order decides.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
