import { cn } from '@/lib/utils'

/**
 * "Gummy", TargetGum's Growth Map mascot - ported from the approved
 * Duolingo-style mockup (docs/DECISIONS.md 2026-09-22). A flat-vector
 * rooster-in-a-hoodie, red comb, target-logo chest emblem. Pure SVG (no
 * external asset) so it themes with the rest of the app and never needs a
 * CDN image host.
 */
export function GummyMascot({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 100 122" className={cn('block', animate && 'motion-safe:animate-sway', className)} aria-hidden="true">
      <ellipse cx="50" cy="82" rx="29" ry="33" fill="#171717" />
      <ellipse cx="50" cy="106" rx="24" ry="7" fill="#E5252A" />
      <ellipse cx="22" cy="78" rx="9" ry="16" fill="#171717" transform="rotate(-18 22 78)" />
      <ellipse cx="82" cy="62" rx="9" ry="17" fill="#171717" transform="rotate(35 82 62)" />
      <circle cx="14" cy="90" r="5.5" fill="#F5A623" />
      <circle cx="90" cy="48" r="5.5" fill="#F5A623" />
      <ellipse cx="50" cy="85" rx="16" ry="22" fill="#FFFFFF" />
      <circle cx="50" cy="66" r="9.5" fill="#E5252A" />
      <circle cx="50" cy="66" r="5.8" fill="#FFFFFF" />
      <circle cx="50" cy="66" r="2.6" fill="#E5252A" />
      <circle cx="50" cy="34" r="24" fill="#FFFFFF" />
      <path d="M32 14 L38 1 L44 14 L50 -1 L56 14 L62 1 L68 14 Z" fill="#E5252A" />
      <ellipse cx="33" cy="40" rx="4.2" ry="2.6" fill="#FFC1C1" opacity=".75" />
      <ellipse cx="67" cy="40" rx="4.2" ry="2.6" fill="#FFC1C1" opacity=".75" />
      <circle cx="41" cy="32" r="3.4" fill="#171717" />
      <circle cx="59" cy="32" r="3.4" fill="#171717" />
      <circle cx="42.4" cy="30.6" r="1.1" fill="#fff" />
      <circle cx="60.4" cy="30.6" r="1.1" fill="#fff" />
      <path d="M45 40 L55 40 L50 48 Z" fill="#F5A623" />
      <ellipse cx="38" cy="119" rx="7.5" ry="4" fill="#F5A623" />
      <ellipse cx="62" cy="119" rx="7.5" ry="4" fill="#F5A623" />
    </svg>
  )
}
