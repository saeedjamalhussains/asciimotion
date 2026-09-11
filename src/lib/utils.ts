import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
