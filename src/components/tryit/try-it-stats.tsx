'use client'

import { StreakBadge, XpBadge } from '@/components/gamification/stats'
import { useTryIt } from './use-try-it'

/** The try-it header's XP/streak - this browser's own progress, hidden until there is some. */
export function TryItStats() {
  const { state, hydrated } = useTryIt()
  if (!hydrated || state.completed.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      {state.streak > 0 && <StreakBadge days={state.streak} className="hidden sm:inline-flex" />}
      <XpBadge xp={state.xp} />
    </div>
  )
}
