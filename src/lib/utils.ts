import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges class lists, letting a later Tailwind class win over an earlier conflicting one (shadcn/ui's standard `cn` helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
