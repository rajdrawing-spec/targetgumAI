'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { completeStage } from '@/lib/growth/stages'
import { recordMissionProgress } from '@/lib/growth/missions'
import { AuthenticationError } from '@/lib/rbac/errors'
import type { GrowthStageKey } from '@prisma/client'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions for the Growth Map guided-onboarding wizard - same
 * convention as `src/app/dashboard/clients/actions.ts`: resolve ctx, parse
 * the form/args, call the permission/tenant-checked lib function, return an
 * ActionResult.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

function revalidateGrowth(clientId: string) {
  revalidatePath(`/dashboard/clients/${clientId}/growth`)
}

export async function completeStageAction(clientId: string, stage: GrowthStageKey, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('complete-growth-stage', async () => {
    const ctx = await requireCtx()
    await completeStage(ctx, clientId, stage)
    revalidateGrowth(clientId)
    return actionOk('Stage complete! On to the next one.', { redirectTo: `/dashboard/clients/${clientId}/growth` })
  })
}

export async function recordMissionProgressAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('record-growth-mission-progress', async () => {
    const ctx = await requireCtx()
    const missionKey = formString(formData, 'missionKey')
    if (!missionKey) throw new Error('Mission key is required.')
    const incrementByRaw = formString(formData, 'incrementBy')
    const incrementBy = incrementByRaw ? Number(incrementByRaw) : 1
    const result = await recordMissionProgress(ctx, clientId, missionKey, incrementBy)
    revalidateGrowth(clientId)
    return actionOk(result.completedAt ? 'Mission complete!' : 'Progress saved.')
  })
}
