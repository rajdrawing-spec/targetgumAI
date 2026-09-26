import type { AuthContext } from '@/lib/rbac/types'
import { getGrowthProgress } from './progress'

export type ClientGrowthBadgeData = { xp: number; level: number; streakCount: number }

/**
 * Data for the top bar's streak/XP/level badge (src/components/growth/
 * client-growth-badge.tsx). Never throws: no session, a client-portal
 * user, no `growth.read`, or an inaccessible/nonexistent client all just
 * mean "nothing to show" for this one header widget.
 */
export async function getClientGrowthBadge(ctx: AuthContext | null, clientId: string): Promise<ClientGrowthBadgeData | null> {
  try {
    if (!ctx || ctx.isClientUser || !ctx.permissions.has('growth.read')) return null
    const progress = await getGrowthProgress(ctx, clientId)
    if (!progress) return null
    return { xp: progress.xp, level: progress.level, streakCount: progress.streakCount }
  } catch {
    return null
  }
}
