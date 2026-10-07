import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classi condizionali (clsx) risolvendo i conflitti Tailwind (twMerge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
