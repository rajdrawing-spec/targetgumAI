'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { rejectApproval } from '@/lib/approvals/approvals'
import { addClientCompetitor } from '@/lib/clients/brain'
import { createClient } from '@/lib/clients/create'
import {
  approveContentCalendarItem,
  cancelContentCalendarItem,
  createContentCalendarItem,
  publishContentCalendarItem,
  scheduleContentCalendarItem,
  submitContentForReview,
  syncContentCalendarItemFromApproval,
} from '@/lib/content-calendar/persist'
import {
  approveCreativeAsset,
  generateCreativeDesign,
  rejectCreativeAsset,
  submitCreativeForReview,
} from '@/lib/creative/persist'
import { connectClientToCanvaAccount } from '@/lib/integrations/canva/connect'
import { connectClientToGoogleAdsAccount } from '@/lib/integrations/google-ads/connect'
import { connectClientToMetaAdsAccount } from '@/lib/integrations/meta-ads/connect'
import { connectClientToMetricoolBrand } from '@/lib/integrations/metricool/connect'
import { acceptRecommendation, rejectRecommendation } from '@/lib/recommendations/persist'
import { updateTaskStatus } from '@/lib/recommendations/tasks'
import { generateClientReportFromInternal } from '@/lib/reports/generate'
import { approveAndExecuteApproval } from '@/lib/tools/execute'
import { runAnalyzeClientWorkflow } from '@/lib/workflows/analyze-client-workflow'
import { runCompetitorAnalysisWorkflow } from '@/lib/workflows/competitor-analysis-workflow'
import { runCreativeWorkflow } from '@/lib/workflows/creative-workflow'
import { DEFAULT_ADS_CHANNEL, DEFAULT_RANGE_DAYS, DEFAULT_SOCIAL_NETWORK } from '@/lib/workflows/defaults'
import { runSeoAnalysisWorkflow } from '@/lib/workflows/seo-analysis-workflow'
import { updateClientPolicy } from '@/lib/clients/brain'
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

export async function triggerCompetitorAnalysisAction(clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await runCompetitorAnalysisWorkflow({ ctx, clientId })

  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/recommendations')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/approvals')
  revalidatePath('/dashboard/ai-runs')
  revalidatePath('/dashboard/reports')
}

export async function updateWeeklyAutomationAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const weeklyAutomationEnabled = formData.get('weeklyAutomationEnabled') === 'on'
  await updateClientPolicy(ctx, clientId, { weeklyAutomationEnabled })
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function triggerCreativeWorkflowAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const platform = String(formData.get('platform') ?? DEFAULT_SOCIAL_NETWORK)
  const count = Number(formData.get('count') ?? 3) || 3
  const campaignBrief = String(formData.get('campaignBrief') ?? '')
  await runCreativeWorkflow({ ctx, clientId, platform, count, campaignBrief })

  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/creatives')
  revalidatePath('/dashboard/ai-runs')
}

export async function addCompetitorAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const name = String(formData.get('name') ?? '')
  const url = String(formData.get('url') ?? '') || undefined
  const positioning = String(formData.get('positioning') ?? '') || undefined
  const observations = String(formData.get('observations') ?? '') || undefined
  await addClientCompetitor(ctx, clientId, { name, url, positioning, observations })
  revalidatePath(`/dashboard/clients/${clientId}`)
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
  await approveAndExecuteApproval(ctx, approvalId)
  await syncContentCalendarItemFromApproval(approvalId)
  revalidatePath('/dashboard/approvals')
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function rejectApprovalAction(approvalId: string, clientId: string, reason: string): Promise<void> {
  const ctx = await requireCtx()
  await rejectApproval(ctx, approvalId, reason || 'No reason given.')
  await syncContentCalendarItemFromApproval(approvalId)
  revalidatePath('/dashboard/approvals')
  revalidatePath('/dashboard/content-calendar')
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

export async function connectGoogleAdsAccountAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const externalAccountId = String(formData.get('externalAccountId') ?? '')
  const label = String(formData.get('label') ?? '')
  await connectClientToGoogleAdsAccount(ctx, clientId, externalAccountId, label)
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/integrations')
  revalidatePath('/dashboard')
}

export async function connectMetaAdsAccountAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const externalAccountId = String(formData.get('externalAccountId') ?? '')
  const label = String(formData.get('label') ?? '')
  await connectClientToMetaAdsAccount(ctx, clientId, externalAccountId, label)
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/integrations')
  revalidatePath('/dashboard')
}

export async function connectCanvaAccountAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const externalAccountId = String(formData.get('externalAccountId') ?? '')
  const label = String(formData.get('label') ?? '')
  await connectClientToCanvaAccount(ctx, clientId, externalAccountId, label)
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath('/dashboard/integrations')
  revalidatePath('/dashboard')
}

export async function createContentItemAction(clientId: string, formData: FormData): Promise<void> {
  const ctx = await requireCtx()
  const platform = String(formData.get('platform') ?? '')
  const publishDate = new Date(String(formData.get('publishDate') ?? ''))
  const caption = String(formData.get('caption') ?? '') || undefined
  const creativeAssetId = String(formData.get('creativeAssetId') ?? '') || undefined
  await createContentCalendarItem(ctx, clientId, { platform, publishDate, caption, creativeAssetId })
  revalidatePath('/dashboard/content-calendar')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function submitCreativeForReviewAction(assetId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await submitCreativeForReview(ctx, assetId)
  revalidatePath('/dashboard/creatives')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function approveCreativeAction(assetId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await approveCreativeAsset(ctx, assetId)
  revalidatePath('/dashboard/creatives')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function rejectCreativeAction(assetId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await rejectCreativeAsset(ctx, assetId)
  revalidatePath('/dashboard/creatives')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function generateCreativeDesignAction(assetId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await generateCreativeDesign(ctx, assetId)
  revalidatePath('/dashboard/creatives')
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

export async function publishContentItemAction(itemId: string, clientId: string): Promise<void> {
  const ctx = await requireCtx()
  await publishContentCalendarItem(ctx, itemId)
  revalidatePath('/dashboard/content-calendar')
  revalidatePath('/dashboard/approvals')
  revalidatePath(`/dashboard/clients/${clientId}`)
}

export async function generateClientReportAction(internalReportId: string): Promise<void> {
  const ctx = await requireCtx()
  const derived = await generateClientReportFromInternal(ctx, internalReportId)
  revalidatePath('/dashboard/reports')
  revalidatePath(`/dashboard/reports/${internalReportId}`)
  revalidatePath(`/dashboard/clients/${derived.clientId}`)
}
