import { Flame, Gem } from 'lucide-react'
import { xpToNextLevel } from '@/lib/growth/progress'

/**
 * The client workspace header's streak/XP/level cluster (docs/DECISIONS.md
 * 2026-09-24) - the gamification stats from the reference mockup's top bar,
 * scoped to one client's `ClientGrowthProgress` rather than shown globally.
 * A single streak/XP number can't mean anything at the top of the whole
 * app: this is a multi-tenant agency tool, and an agency managing many
 * clients has no one "your streak" - each client has its own Growth Map
 * journey. So this renders inside the Client Workspace header (where a
 * client is already in scope) instead of the app-wide top bar.
 */
export function ClientGrowthBadge({ xp, level, streakCount }: { xp: number; level: number; streakCount: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {streakCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold text-warning" title={`${streakCount}-day streak`}>
          <Flame className="h-3.5 w-3.5" /> {streakCount}
        </span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary" title={`${xpToNextLevel(xp)} XP to next level`}>
        <Gem className="h-3.5 w-3.5" /> {xp.toLocaleString()} XP
      </span>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background" title={`Level ${level}`}>
        {level}
      </span>
    </div>
  )
}
