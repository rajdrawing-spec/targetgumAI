import type { ReactNode } from 'react'
import { GummyMascot, type GummyMood } from './mascot'

/**
 * The success moment after a quest claim or shop purchase (docs/
 * DECISIONS.md 2026-09-24). Those actions redirect back with a flag
 * (`?claimed=` etc.) rather than toasting from an in-place re-render, and
 * the page renders this banner from the flag - only after checking it
 * against real data, so a hand-typed URL can't show a fake celebration.
 */
export function CelebrationBanner({ title, children, mood = 'celebrate' }: { title: string; children?: ReactNode; mood?: GummyMood }) {
  return (
    <div role="status" className="flex items-center gap-4 rounded-3xl border-2 border-success/30 bg-success-bg p-4 motion-safe:animate-fade-in-up">
      <GummyMascot mood={mood} animate className="h-16 w-14 shrink-0" />
      <div>
        <p className="font-display text-xl font-extrabold text-success">{title}</p>
        {children && <p className="text-sm text-foreground">{children}</p>}
      </div>
    </div>
  )
}
