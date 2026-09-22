import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import type { GrowthMissionCadence } from '@prisma/client'
import { applyGrowthActivity } from './progress'
import { maybeUnlockAchievement } from './achievements'

/**
 * Daily/weekly Growth Map missions. `GrowthMission` is a small platform-
 * managed catalog (seeded in prisma/seed.ts), not per-organization
 * content - see docs/DATA-MODEL.md "Growth Map".
 */

/** Start of the current UTC day (DAILY) or UTC ISO week, Monday-anchored (WEEKLY). */
function periodStartFor(cadence: GrowthMissionCadence, now: Date): Date {
  if (cadence === 'DAILY') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
  const day = now.getUTCDay() // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset))
  return monday
}

export async function listActiveMissions(ctx: AuthContext) {
  assertPermission(ctx, 'growth.read')
  return db.growthMission.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
}

/** Active missions joined with this client's progress for the mission's current period. */
export async function getMissionProgress(ctx: AuthContext, clientId: string, now: Date = new Date()) {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const missions = await db.growthMission.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  if (missions.length === 0) return []

  const progressRows = await db.clientGrowthMissionProgress.findMany({
    where: {
      clientId: client.id,
      OR: missions.map((m) => ({ missionId: m.id, periodStart: periodStartFor(m.cadence, now) })),
    },
  })
  const progressByMissionId = new Map(progressRows.map((p) => [p.missionId, p]))

  return missions.map((mission) => {
    const progress = progressByMissionId.get(mission.id)
    return {
      mission,
      progressCount: progress?.progressCount ?? 0,
      completedAt: progress?.completedAt ?? null,
      periodStart: periodStartFor(mission.cadence, now),
    }
  })
}

/**
 * Advances a client's progress on one mission by `incrementBy` (default 1),
 * capped at the mission's `targetCount`. Awards the mission's XP and rolls
 * up into the shared streak the first time it's completed for its current
 * period; calling again after completion is a no-op (idempotent).
 */
export async function recordMissionProgress(
  ctx: AuthContext,
  clientId: string,
  missionKey: string,
  incrementBy = 1,
  now: Date = new Date(),
) {
  assertPermission(ctx, 'growth.write')
  const client = await getAuthorizedClient(ctx, clientId)

  const mission = await db.growthMission.findUnique({ where: { key: missionKey } })
  if (!mission || !mission.isActive) {
    throw new Error('That mission is not available.')
  }

  const periodStart = periodStartFor(mission.cadence, now)
  const existing = await db.clientGrowthMissionProgress.findUnique({
    where: { clientId_missionId_periodStart: { clientId: client.id, missionId: mission.id, periodStart } },
  })
  if (existing?.completedAt) return existing // already completed this period - nothing more to do

  const progressCount = Math.min((existing?.progressCount ?? 0) + incrementBy, mission.targetCount)
  const justCompleted = progressCount >= mission.targetCount

  const updated = await db.clientGrowthMissionProgress.upsert({
    where: { clientId_missionId_periodStart: { clientId: client.id, missionId: mission.id, periodStart } },
    create: {
      organizationId: ctx.organizationId,
      clientId: client.id,
      missionId: mission.id,
      periodStart,
      progressCount,
      completedAt: justCompleted ? now : null,
    },
    update: { progressCount, completedAt: justCompleted ? now : undefined },
  })

  if (justCompleted) {
    const growth = await applyGrowthActivity(ctx.organizationId, client.id, mission.xpReward, now)
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId: client.id,
      userId: ctx.userId,
      action: 'growth.mission_complete',
      inputSummary: { missionKey },
      result: 'SUCCESS',
    })
    if (growth.streakCount >= 7) await maybeUnlockAchievement(ctx, client.id, '7-day-streak')
  }

  return updated
}

/**
 * "Weekly Goal" card: how many missions (any cadence) this client has
 * completed since the current UTC week started. Not a mission of its own -
 * a mission that meant "complete N other missions" would need to know
 * about every other mission's completion, which nothing here tracks - so
 * this stays a plain count over `ClientGrowthMissionProgress` instead.
 */
export async function getWeeklyMissionCompletionCount(ctx: AuthContext, clientId: string, now: Date = new Date()): Promise<number> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const weekStart = periodStartFor('WEEKLY', now)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  return db.clientGrowthMissionProgress.count({
    where: { clientId: client.id, completedAt: { gte: weekStart, lt: weekEnd } },
  })
}
