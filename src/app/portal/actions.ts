'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { addClientFeedback } from '@/lib/clients/brain'
import { acceptRecommendation, rejectRecommendation } from '@/lib/recommendations/persist'

/**
 * Server Actions backing the Client Portal - same thin-wrapper pattern as
 * `src/app/dashboard/actions.ts` (resolve ctx, call straight into an
 * already permission/tenant-checked library function, no authorization
 * logic here). Kept separate from the dashboard's actions rather than
 * reused because they `revalidatePath` the portal's own routes, not the
 * dashboard's.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new Error('Not authenticated.')
  return ctx
}

export async function portalAcceptRecommendationAction(recommendationId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await acceptRecommendation(ctx, recommendationId)
  revalidatePath(`/portal/clients/${clientId}`)
}

export async function portalRejectRecommendationAction(
  recommendationId: string,
  clientId: string,
  reason: string,
): Promise<void> {
  const ctx = await requireCtx()
  await rejectRecommendation(ctx, recommendationId, reason || 'No reason given.')
  revalidatePath(`/portal/clients/${clientId}`)
}

/**
 * `source` is never taken from the form - always 'CLIENT' here, regardless
 * of what a request body claims, since this action is only reachable by a
 * signed-in client_user in the first place.
 */
export async function submitFeedbackAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const content = String(formData.get('content') ?? '').trim()
  if (!content) return
  await addClientFeedback(ctx, clientId, { category: 'GENERAL_NOTE', content, source: 'CLIENT' })
  revalidatePath(`/portal/clients/${clientId}`)
}
