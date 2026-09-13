'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { addClientFeedback } from '@/lib/clients/brain'
import { acceptRecommendation, rejectRecommendation } from '@/lib/recommendations/persist'
import { AuthenticationError } from '@/lib/rbac/errors'
import { actionOk, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions backing the Client Portal - same thin-wrapper pattern as
 * `src/app/dashboard/actions.ts` (resolve ctx, validate, call straight into
 * an already permission/tenant-checked library function, return an
 * ActionResult). Kept separate from the dashboard's actions because they
 * `revalidatePath` the portal's own routes, not the dashboard's.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

export async function portalAcceptRecommendationAction(recommendationId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('portal-accept', async () => {
    const ctx = await requireCtx()
    await acceptRecommendation(ctx, recommendationId)
    revalidatePath(`/portal/clients/${clientId}`)
    return actionOk('Approved - your team has been notified.')
  })
}

const reasonSchema = z.object({
  reason: z.string().trim().min(3, 'Please tell your team why (a short sentence is enough).').max(1000),
})

export async function portalRejectRecommendationAction(recommendationId: string, clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('portal-reject', async () => {
    const ctx = await requireCtx()
    const { reason } = reasonSchema.parse({ reason: formData.get('reason') ?? '' })
    await rejectRecommendation(ctx, recommendationId, reason)
    revalidatePath(`/portal/clients/${clientId}`)
    return actionOk('Declined - your reason was shared with your team.')
  })
}

const feedbackSchema = z.object({
  content: z.string().trim().min(3, 'Write a little more so your team can act on it.').max(4000),
})

/**
 * `source` is never taken from the form - always 'CLIENT' here, regardless
 * of what a request body claims, since this action is only reachable by a
 * signed-in client in the first place.
 */
export async function submitFeedbackAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('portal-feedback', async () => {
    const ctx = await requireCtx()
    const { content } = feedbackSchema.parse({ content: formData.get('content') ?? '' })
    await addClientFeedback(ctx, clientId, { category: 'GENERAL_NOTE', content, source: 'CLIENT' })
    revalidatePath(`/portal/clients/${clientId}`)
    return actionOk('Thanks - your feedback was sent to your team.')
  })
}
