'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { approveApproval, rejectApproval } from '@/lib/approvals/approvals'
import { createClient } from '@/lib/clients/create'
import {
  approveContentCalendarItem,
  cancelContentCalendarItem,
  createContentCalendarItem,
  scheduleContentCalendarItem,
  submitContentForReview,
} from '@/lib/content-calendar/persist'
import { connectClientToMetricoolBrand } from '@/lib/integrations/metricool/connect'
import { acceptRecommendation, rejectRecommendation } from '@/lib/recommendations/persist'
import { updateTaskStatus } from '@/lib/recommendations/tasks'
import { generateClientReportFromInternal } from '@/lib/reports/generate'
import { runAnalyzeClientWorkflow } from '@/lib/workflows/analyze-client-workflow'
import { runSeoAnalysisWorkflow } from '@/lib/workflows/seo-analysis-workflow'
import type { TaskStatus } from '@prisma/client'

/**
 * Server Actions backing the Day 13 dashboard. Every one of these is a
 * thin wrapper: it resolves the caller's AuthContext and calls straight
 * into an already permission/tenant-checked library function (Days 8-11) -
 * no authorization logic lives here. `revalidatePath` refreshes whichever
 * dashboard pages show the changed data.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new Error('Not authenticated.')
  return ctx
}

/** The DEFAULT_RANGE_DAYS / socialNetwork / adsChannel below are MVP placeholders - a client-level "default channel" setting (Client Brain/policy) is the natural home for these once more than one network/channel is in play. */
const DEFAULT_RANGE_DAYS = 30
const DEFAULT_SOCIAL_NETWORK = 'instagram'
const DEFAULT_ADS_CHANNEL = 'googleAds'

export async function triggerAnalyzeClientAction(clientId: string): Promise<void> {
  const ctx = await requireCtx()
  const to = new Date()
  const from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)

  await runAnalyzeClientWorkflow({
    ctx,
    clientId,
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    socialNetwork: DEFAULT_SOCIAL_NETWORK,
    adsChannel: DEFAULT_ADS_CHANNEL,
  })

  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/recommendations')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/approvals')
  revalidatePath('/dashboard/ai-runs')
}

export async function triggerSeoAnalysisAction(clientId: string): Promise<void> {
  const ctx = await requireCtx()
  const to = new Date()
  const from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)

  await runSeoAnalysisWorkflow({
    ctx,
    clientId,
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
  })

  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/seo')
  revalidatePath('/dashboard/recommendations')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/approvals')
  revalidatePath('/dashboard/ai-runs')
  revalidatePath('/dashboard/reports')
}

export async function acceptRecommendationAction(recommendationId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await acceptRecommendation(ctx, recommendationId)
  revalidatePath('/dashboard/recommendations')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function rejectRecommendationAction(
  recommendationId: string,
  clientId: string,
  reason: string,
): Promise<void> {
  const ctx = await requireCtx()
  await rejectRecommendation(ctx, recommendationId, reason || 'No reason given.')
  revalidatePath('/dashboard/recommendations')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function updateTaskStatusAction(taskId: string, clientId: string, status: TaskStatus): Promise<void> {
  const ctx = await requireCtx()
  await updateTaskStatus(ctx, taskId, status)
  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function approveApprovalAction(approvalId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await approveApproval(ctx, approvalId)
  revalidatePath('/dashboard/approvals')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function rejectApprovalAction(approvalId: string, clientId: string, reason: string): Promise<void> {
  const ctx = await requireCtx()
  await rejectApproval(ctx, approvalId, reason || 'No reason given.')
  revalidatePath('/dashboard/approvals')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function createClientAction(formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const name = String(formData.get('name') ?? '')
  const client = await createClient(ctx, { name })
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard')
  redirect(`/dashboard/clients/${client.id}`)
}

export async function connectMetricoolBrandAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const brandId = String(formData.get('brandId') ?? '')
  const label = String(formData.get('label') ?? '')
  await connectClientToMetricoolBrand(ctx, clientId, brandId, label)
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/integrations')
  revalidatePath('/dashboard')
}

export async function createContentItemAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const platform = String(formData.get('platform') ?? '')
  const publishDate = new Date(String(formData.get('publishDate') ?? ''))
  const caption = String(formData.get('caption') ?? '') || undefined
  await createContentCalendarItem(ctx, clientId, { platform, publishDate, caption })
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function submitContentForReviewAction(itemId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await submitContentForReview(ctx, itemId)
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function approveContentItemAction(itemId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await approveContentCalendarItem(ctx, itemId)
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function cancelContentItemAction(itemId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await cancelContentCalendarItem(ctx, itemId)
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function scheduleContentItemAction(itemId: string, clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const networks = String(formData.get('networks') ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  await scheduleContentCalendarItem(ctx, itemId, { networks })
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function generateClientReportAction(internalReportId: string): Promise<void> {
  const ctx = await requireCtx()
  const derived = await generateClientReportFromInternal(ctx, internalReportId)
  revalidatePath('/dashboard/reports')
  revalidatePath(`/dashboard/reports/${internalReportId}`)
  revalidatePath(`/dashboard/clients/${derived.clientId}`)
}
