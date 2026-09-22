import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import type { GrowthStageKey } from '@prisma/client'
import { applyGrowthActivity } from './progress'
import { maybeUnlockAchievement } from './achievements'
import { FIRST_GROWTH_STAGE, GROWTH_STAGE_DEFS, GROWTH_STAGE_ORDER, type GrowthStageDef } from './stage-defs'

export { FIRST_GROWTH_STAGE, GROWTH_STAGE_DEFS, GROWTH_STAGE_ORDER, type GrowthStageDef } from './stage-defs'

export const STAGE_XP_REWARD = 100

/** done/current/locked node states for the map UI, derived from completion history. */
export async function getStageStates(
  ctx: AuthContext,
  clientId: string,
): Promise<Array<GrowthStageDef & { status: 'done' | 'current' | 'locked'; completedAt: Date | null }>> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const [progress, completions] = await Promise.all([
    db.clientGrowthProgress.findUnique({ where: { clientId: client.id } }),
    db.clientGrowthStageCompletion.findMany({ where: { clientId: client.id } }),
  ])
  const completedAtByStage = new Map(completions.map((c) => [c.stage, c.completedAt]))
  const currentStage = progress?.currentStage ?? FIRST_GROWTH_STAGE
  const currentIndex = GROWTH_STAGE_ORDER.indexOf(currentStage)

  return GROWTH_STAGE_DEFS.map((def, index) => ({
    ...def,
    completedAt: completedAtByStage.get(def.key) ?? null,
    status: completedAtByStage.has(def.key) ? 'done' : index === currentIndex ? 'current' : 'locked',
  }))
}

/**
 * Marks the client's *current* stage complete, advances to the next one,
 * awards XP, and updates the streak. Stages must be completed in order -
 * this only ever accepts the stage the client is currently on (mirrors
 * the map UI, which only ever shows one "current" node as clickable).
 */
export async function completeStage(ctx: AuthContext, clientId: string, stage: GrowthStageKey) {
  assertPermission(ctx, 'growth.write')
  const client = await getAuthorizedClient(ctx, clientId)

  const progress = await db.clientGrowthProgress.findUnique({ where: { clientId: client.id } })
  const currentStage = progress?.currentStage ?? FIRST_GROWTH_STAGE
  if (stage !== currentStage) {
    throw new Error('Complete stages in order - that is not the current stage.')
  }

  const alreadyDone = await db.clientGrowthStageCompletion.findUnique({
    where: { clientId_stage: { clientId: client.id, stage } },
  })
  if (alreadyDone) {
    throw new Error('That stage is already completed.')
  }

  await db.clientGrowthStageCompletion.create({
    data: { organizationId: ctx.organizationId, clientId: client.id, stage, completedBy: ctx.userId },
  })

  const currentIndex = GROWTH_STAGE_ORDER.indexOf(stage)
  const nextStage = GROWTH_STAGE_ORDER[currentIndex + 1] ?? stage // stays put once the final stage is done

  const updated = await applyGrowthActivity(ctx.organizationId, client.id, STAGE_XP_REWARD)
  const withNextStage = await db.clientGrowthProgress.update({
    where: { clientId: client.id },
    data: { currentStage: nextStage },
  })

  await recordAuditEvent({
    organizationId: ctx.organizationId,
    clientId: client.id,
    userId: ctx.userId,
    action: 'growth.stage_complete',
    inputSummary: { stage },
    result: 'SUCCESS',
  })

  const stageAchievement: Partial<Record<GrowthStageKey, string>> = {
    UNDERSTAND_AUDIENCE: 'audience-explorer',
    CREATE_CREATIVE_ASSETS: 'creative-master',
    LAUNCH_CAMPAIGN: 'first-campaign',
    OPTIMIZE: 'optimization-expert',
    SCALE_GROW: 'growth-master',
  }
  const achievementKey = stageAchievement[stage]
  if (achievementKey) await maybeUnlockAchievement(ctx, client.id, achievementKey)
  if (updated.streakCount >= 7) await maybeUnlockAchievement(ctx, client.id, '7-day-streak')

  return withNextStage
}
