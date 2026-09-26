'use client'

import type { ReactNode } from 'react'
import { GummyMascot } from '@/components/growth/mascot'
import { useGummyStyle } from '@/components/growth/gummy-style'
import { cn } from '@/lib/utils'

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 6) * 0.12}s`,
  color: ['bg-primary', 'bg-mustard', 'bg-info', 'bg-success', 'bg-foreground'][i % 5],
  // Growth Shop "Gold Celebration" (docs/DECISIONS.md 2026-09-24).
  gold: ['bg-mustard', 'bg-warning', 'bg-mustard/70'][i % 3],
  shape: i % 3 === 0 ? 'h-2 w-2 rounded-full' : 'h-3 w-1.5 rounded-sm',
}))

export interface CompletionStat {
  icon: ReactNode
  value: string
  label: string
}

/**
 * The lesson-complete celebration (reference: "Lesson Complete! You
 * earned +100 XP"). Confetti and the hop are `motion-safe` only and play
 * once; the XP figure is real text so screen readers get the result.
 * Actions (claim / next lesson / review / campaign bridge) are passed in
 * by the caller, since in-app and public try-it complete differently.
 */
export function LessonComplete({
  heading = 'Lesson complete!',
  summary,
  xp,
  stats,
  children,
}: {
  heading?: string
  summary: string
  /** XP shown as earned. Pass null when nothing is awarded (e.g. review mode). */
  xp: number | null
  stats: CompletionStat[]
  children: ReactNode
}) {
  const { goldCelebration } = useGummyStyle()
  return (
    <div className="relative mx-auto flex max-w-lg flex-col items-center gap-5 overflow-hidden px-4 py-10 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 motion-reduce:hidden" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span key={i} className={cn('absolute top-0 opacity-0 motion-safe:animate-confetti', goldCelebration ? c.gold : c.color, c.shape)} style={{ left: c.left, animationDelay: c.delay }} />
        ))}
      </div>

      <GummyMascot mood="celebrate" animate className="h-36 w-28" />
      <div role="status" className="space-y-1">
        <h2 className="font-display text-3xl font-extrabold text-foreground">{heading}</h2>
        {xp !== null && (
          <p className="text-lg font-semibold text-foreground">
            You earned <span className="inline-block text-primary motion-safe:animate-pop">+{xp} XP</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>

      {stats.length > 0 && (
        <dl className="grid w-full grid-cols-3 divide-x divide-border rounded-2xl border-2 border-border bg-card py-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-primary" aria-hidden="true">
                {s.icon}
              </span>
              {/* dt must precede dd in a <dl>; `order-last` keeps the value visually on top. */}
              <dt className="order-last text-xs text-muted-foreground">{s.label}</dt>
              <dd className="font-display text-xl font-bold text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex w-full flex-col gap-3">{children}</div>
    </div>
  )
}
