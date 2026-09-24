import { Flame, Gem, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared gamification primitives (docs/DECISIONS.md 2026-09-24) - the
 * XP / streak / hearts / progress pieces used by the lesson player, the
 * public try-it map and the in-app Growth Map, so every surface shows
 * these numbers the same way. Presentational only: callers pass real
 * values (ClientGrowthProgress in-app, browser-local progress on the
 * public try-it pages); nothing here invents a number.
 */

export function XpBadge({ xp, className }: { xp: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary', className)}>
      <Gem className="h-3.5 w-3.5" aria-hidden="true" />
      {xp.toLocaleString()} XP
    </span>
  )
}

export function StreakBadge({ days, className }: { days: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold text-warning', className)}
      title={`${days}-day streak`}
    >
      <Flame className="h-3.5 w-3.5 motion-safe:animate-flicker" aria-hidden="true" />
      {days}
      <span className="sr-only">-day streak</span>
    </span>
  )
}

export function HeartCounter({ hearts, className }: { hearts: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-base font-bold text-primary', className)} aria-label={`${hearts} hearts left`}>
      <Heart className={cn('h-5 w-5', hearts > 0 && 'fill-current')} aria-hidden="true" />
      <span aria-hidden="true">{hearts}</span>
    </span>
  )
}

export function ProgressBar({
  value,
  max,
  label,
  className,
  tone = 'primary',
}: {
  value: number
  max: number
  /** Accessible name, e.g. "Lesson progress". */
  label: string
  className?: string
  tone?: 'primary' | 'success'
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-3 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tone === 'success' ? 'bg-success' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
