import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { ensureQuestCatalog, getMissionProgress, periodEndFor, periodStartFor, recordMissionProgress } from './missions'
import { maybeUnlockAchievement } from './achievements'
import { getQuestDef, QUEST_DEFS, type QuestDef } from './quest-defs'

/**
 * Marketing Quests (docs/DECISIONS.md 2026-09-24): the board shown on the
 * Quests page, and the claim path for verified quests.
 *
 * A verified quest's progress is COUNTED from real records for its
 * current period - never taken from the request. Claiming recounts on the
 * server and refuses unless the target is met; the award then goes
 * through the same idempotent `recordMissionProgress` (one completion per
 * period, XP + streak via applyGrowthActivity, audit event).
 */

type Window = { from: Date; to: Date | null }

const inWindow = (w: Window) => (w.to ? { gte: w.from, lt: w.to } : undefined)

/** Real-record counters, one per verified quest key. `clientId` is already authorized by the caller. */
const QUEST_VERIFIERS: Record<string, (clientId: string, w: Window) => Promise<number>> = {
  'complete-a-lesson': (clientId, w) => db.clientGrowthStageCompletion.count({ where: { clientId, completedAt: inWindow(w) } }),
  'create-3-creatives': (clientId, w) => db.creativeAsset.count({ where: { clientId, createdAt: inWindow(w) } }),
  'run-marketing-analysis': (clientId, w) => db.workflowRun.count({ where: { clientId, status: 'SUCCEEDED', createdAt: inWindow(w) } }),
  'launch-first-campaign': (clientId) => db.campaign.count({ where: { clientId } }),
  'connect-first-integration': (clientId) => db.integrationConnection.count({ where: { clientId, status: 'CONNECTED' } }),
  'finish-five-stages': (clientId) => db.clientGrowthStageCompletion.count({ where: { clientId } }),
  // Every other quest completed in this week (DAILY/WEEKLY/SPECIAL alike) - never itself.
  'weekly-goal': (clientId, w) =>
    db.clientGrowthMissionProgress.count({ where: { clientId, completedAt: inWindow(w), mission: { key: { not: 'weekly-goal' } } } }),
}

/** Every verified quest in the catalog must have a counter (enforced by tests/unit/growth-quests.test.ts). */
export const VERIFIER_KEYS = Object.keys(QUEST_VERIFIERS)

export interface QuestCard {
  key: string
  cadence: QuestDef['cadence']
  title: string
  description: string
  xpReward: number
  targetCount: number
  icon: QuestDef['icon']
  verified: boolean
  /** Verified: the real count (capped at target). Self-reported: the logged count. */
  progressCount: number
  completedAt: Date | null
  /** Verified quest whose target is met but whose XP hasn't been claimed yet. */
  claimable: boolean
}

export async function getQuestBoard(ctx: AuthContext, clientId: string, now: Date = new Date()): Promise<QuestCard[]> {
  const rows = await getMissionProgress(ctx, clientId, now) // asserts growth.read + client access
  return Promise.all(
    rows.map(async ({ mission, progressCount, completedAt, periodStart }) => {
      const def = getQuestDef(mission.key)
      const verifier = def?.verified ? QUEST_VERIFIERS[mission.key] : undefined
      const counted = verifier ? await verifier(clientId, { from: periodStart, to: periodEndFor(mission.cadence, periodStart) }) : null
      const count = completedAt ? mission.targetCount : Math.min(counted ?? progressCount, mission.targetCount)
      return {
        key: mission.key,
        cadence: mission.cadence,
        title: mission.title,
        description: mission.description ?? '',
        xpReward: mission.xpReward,
        targetCount: mission.targetCount,
        icon: def?.icon ?? 'map',
        verified: Boolean(verifier),
        progressCount: count,
        completedAt,
        claimable: Boolean(verifier) && !completedAt && count >= mission.targetCount,
      }
    }),
  )
}

/**
 * Claims a verified quest's XP after recounting its real records. Throws
 * (plain-language, shown to the user) when the quest isn't verified or the
 * work isn't done yet. Idempotent per period via recordMissionProgress.
 */
export async function claimVerifiedQuest(ctx: AuthContext, clientId: string, questKey: string, now: Date = new Date()) {
  assertPermission(ctx, 'growth.write')
  const client = await getAuthorizedClient(ctx, clientId)
  const def = getQuestDef(questKey)
  const verifier = QUEST_VERIFIERS[questKey]
  if (!def?.verified || !verifier) throw new Error('That quest can’t be claimed.')

  await ensureQuestCatalog() // a claim can be the first quest call after a restart
  const mission = await db.growthMission.findUnique({ where: { key: questKey } })
  if (!mission || !mission.isActive) throw new Error('That quest is not available.')

  const periodStart = periodStartFor(mission.cadence, now)
  const count = await verifier(client.id, { from: periodStart, to: periodEndFor(mission.cadence, periodStart) })
  if (count < mission.targetCount) {
    throw new Error(`Not done yet - ${count} of ${mission.targetCount}. Finish it, then claim your XP.`)
  }

  const result = await recordMissionProgress(ctx, client.id, questKey, mission.targetCount, now, { verified: true })
  if (questKey === 'launch-first-campaign') await maybeUnlockAchievement(ctx, client.id, 'first-campaign')
  return result
}

/**
 * Mon..Sun of the current UTC week: true where this client earned XP that
 * day (a stage or a quest completed). Drives the Quests page's streak row
 * from real completions rather than guessing from the streak number.
 */
export async function getActiveDaysThisWeek(ctx: AuthContext, clientId: string, now: Date = new Date()): Promise<boolean[]> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const weekStart = periodStartFor('WEEKLY', now)
  const weekEnd = periodEndFor('WEEKLY', weekStart)!
  const window = { gte: weekStart, lt: weekEnd }
  const [stages, quests] = await Promise.all([
    db.clientGrowthStageCompletion.findMany({ where: { clientId: client.id, completedAt: window }, select: { completedAt: true } }),
    db.clientGrowthMissionProgress.findMany({ where: { clientId: client.id, completedAt: window }, select: { completedAt: true } }),
  ])
  const days = Array.from({ length: 7 }, () => false)
  for (const d of [...stages.map((r) => r.completedAt), ...quests.map((r) => r.completedAt)]) {
    if (d) days[Math.floor((d.getTime() - weekStart.getTime()) / 86_400_000)] = true
  }
  return days
}

export { QUEST_DEFS }
