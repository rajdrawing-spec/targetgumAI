import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Growth Map achievement badges. The catalog (icon/label/unlock rule) is
 * fixed application content, not per-organization data - only the unlock
 * *event* is persisted (`ClientGrowthAchievement`, docs/DATA-MODEL.md).
 * Unlock rules are wired from the stage/mission code paths that call
 * `maybeUnlockAchievement` (stages.ts, missions.ts) - this file has no
 * cron or polling logic of its own.
 */

export interface AchievementDef {
  key: string
  title: string
  description: string
}

export const ACHIEVEMENT_CATALOG: readonly AchievementDef[] = [
  { key: 'first-campaign', title: 'First Campaign', description: 'Launched your first campaign.' },
  { key: 'audience-explorer', title: 'Audience Explorer', description: 'Completed audience research.' },
  { key: '7-day-streak', title: '7-Day Streak', description: 'Stayed active 7 days running.' },
  { key: 'creative-master', title: 'Creative Master', description: 'Generated your first set of creative assets.' },
  { key: 'optimization-expert', title: 'Optimization Expert', description: 'Completed a full optimization pass.' },
  { key: 'growth-master', title: 'Growth Master', description: 'Completed the entire Growth Map.' },
]

/**
 * Unlocks `achievementKey` for `clientId` if not already unlocked.
 * Idempotent and silent on a repeat call (no error, no duplicate row) -
 * callers invoke this speculatively every time the triggering condition is
 * newly true, without checking first. Assumes the caller has already
 * authorized `growth.write` and resolved/validated the client (stages.ts,
 * missions.ts) - not a standalone entry point, so it takes a raw clientId
 * rather than re-running `getAuthorizedClient`.
 */
export async function maybeUnlockAchievement(ctx: AuthContext, clientId: string, achievementKey: string): Promise<void> {
  if (!ACHIEVEMENT_CATALOG.some((a) => a.key === achievementKey)) {
    throw new Error(`Unknown achievement key: ${achievementKey}`)
  }
  const existing = await db.clientGrowthAchievement.findUnique({
    where: { clientId_achievementKey: { clientId, achievementKey } },
  })
  if (existing) return

  await db.clientGrowthAchievement.create({
    data: { organizationId: ctx.organizationId, clientId, achievementKey },
  })
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    action: 'growth.achievement_unlocked',
    inputSummary: { achievementKey },
    result: 'SUCCESS',
  })
}

/** Read-only: the full catalog with each badge's unlocked state for this client. */
export async function listAchievements(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const unlocked = await db.clientGrowthAchievement.findMany({ where: { clientId: client.id } })
  const unlockedByKey = new Map(unlocked.map((u) => [u.achievementKey, u.unlockedAt]))
  return ACHIEVEMENT_CATALOG.map((def) => ({
    ...def,
    unlocked: unlockedByKey.has(def.key),
    unlockedAt: unlockedByKey.get(def.key) ?? null,
  }))
}
