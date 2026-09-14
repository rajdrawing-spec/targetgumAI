'use server'

import type { IntegrationProvider } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { rejectApproval } from '@/lib/approvals/approvals'
import { syncCampaignFromApproval } from '@/lib/ads/service'
import { addClientCompetitor, updateClientPolicy } from '@/lib/clients/brain'
import { createClient } from '@/lib/clients/create'
import { PROVIDER_LABEL } from '@/components/clients/labels'
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
import { connectClientToPlaceholderAccount, disconnectClientFromProvider } from '@/lib/integrations/connections'
import { connectClientToGoogleAdsAccount } from '@/lib/integrations/google-ads/connect'
import { connectClientToAmazonAdsAccount } from '@/lib/integrations/amazon-ads/connect'
import { connectClientToMetaAdsAccount } from '@/lib/integrations/meta-ads/connect'
import { syncMetaAdAccountTelemetry } from '@/lib/integrations/meta-ads/sync'
import { connectClientToMetricoolBrand } from '@/lib/integrations/metricool/connect'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/notifications/service'
import { acceptRecommendation, rejectRecommendation } from '@/lib/recommendations/persist'
import { updateTaskStatus } from '@/lib/recommendations/tasks'
import { generateClientReportFromInternal } from '@/lib/reports/generate'
import { approveAndExecuteApproval } from '@/lib/tools/execute'
import { runAnalyzeClientWorkflow } from '@/lib/workflows/analyze-client-workflow'
import { runCompetitorAnalysisWorkflow } from '@/lib/workflows/competitor-analysis-workflow'
import { runCreativeWorkflow } from '@/lib/workflows/creative-workflow'
import { DEFAULT_ADS_CHANNEL, DEFAULT_RANGE_DAYS, DEFAULT_SOCIAL_NETWORK } from '@/lib/workflows/defaults'
import { runSeoAnalysisWorkflow } from '@/lib/workflows/seo-analysis-workflow'
import { AuthenticationError } from '@/lib/rbac/errors'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions backing the dashboard. Every one of these is a thin
 * wrapper: it resolves the caller's AuthContext and calls straight into an
 * already permission/tenant-checked library function - no authorization
 * logic lives here. Inputs are validated with Zod before any lib call, and
 * every action returns an `ActionResult` (never throws to the client) so
 * `ActionForm` can show pending / inline-error / success states
 * (src/components/ui/action-form.tsx). `revalidatePath` refreshes whichever
 * dashboard pages show the changed data; the calling page's new RSC
 * payload is returned with the action response, so no reload is needed.
 *
 * Signature convention: `(…boundArgs, prevState, formData)` - bound with
 * `.bind(null, …)` in the page, then driven by `useActionState`.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

function last30Days() {
  const to = new Date()
  const from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

const reasonSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a short reason (at least 3 characters).').max(1000),
})

// ---------------------------------------------------------------- analysis

export async function triggerAnalyzeClientAction(clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('analyze-client', async () => {
    const ctx = await requireCtx()
    await runAnalyzeClientWorkflow({
      ctx,
      clientId,
      range: last30Days(),
      socialNetwork: DEFAULT_SOCIAL_NETWORK,
      adsChannel: DEFAULT_ADS_CHANNEL,
    })
    revalidateClient(clientId)
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/recommendations')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/ai-runs')
    revalidatePath('/dashboard/reports')
    return actionOk('Analysis complete. New findings, recommendations and a report are ready.')
  })
}

export async function triggerSeoAnalysisAction(clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('seo-analysis', async () => {
    const ctx = await requireCtx()
    await runSeoAnalysisWorkflow({ ctx, clientId, range: last30Days() })
    revalidateClient(clientId)
    revalidatePath('/dashboard/seo')
    revalidatePath('/dashboard/recommendations')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/ai-runs')
    revalidatePath('/dashboard/reports')
    return actionOk('SEO analysis complete.')
  })
}

export async function triggerCompetitorAnalysisAction(clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('competitor-analysis', async () => {
    const ctx = await requireCtx()
    await runCompetitorAnalysisWorkflow({ ctx, clientId })
    revalidateClient(clientId)
    revalidatePath('/dashboard/recommendations')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/ai-runs')
    revalidatePath('/dashboard/reports')
    return actionOk('Competitor analysis complete.')
  })
}

const creativeSchema = z.object({
  platform: z.string().trim().min(1, 'Platform is required.').max(40),
  count: z.coerce.number().int('Whole numbers only.').min(1, 'At least 1.').max(10, 'At most 10 concepts per run.'),
  campaignBrief: z.string().trim().min(3, 'Describe the campaign in a few words.').max(2000),
})

export async function triggerCreativeWorkflowAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('creative-workflow', async () => {
    const ctx = await requireCtx()
    const input = creativeSchema.parse({
      platform: formData.get('platform') ?? DEFAULT_SOCIAL_NETWORK,
      count: formData.get('count') ?? 3,
      campaignBrief: formData.get('campaignBrief') ?? '',
    })
    await runCreativeWorkflow({ ctx, clientId, ...input })
    revalidateClient(clientId)
    revalidatePath('/dashboard/creatives')
    revalidatePath('/dashboard/ai-runs')
    return actionOk(`${input.count} creative concept${input.count === 1 ? '' : 's'} generated. Review them under Creatives.`)
  })
}

// ---------------------------------------------------------------- client profile

export async function updateWeeklyAutomationAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('weekly-automation', async () => {
    const ctx = await requireCtx()
    const weeklyAutomationEnabled = formData.get('weeklyAutomationEnabled') === 'on'
    await updateClientPolicy(ctx, clientId, { weeklyAutomationEnabled })
    revalidateClient(clientId)
    return actionOk(weeklyAutomationEnabled ? 'Weekly automated intelligence enabled.' : 'Weekly automated intelligence disabled.')
  })
}

const competitorSchema = z.object({
  name: z.string().trim().min(1, 'Competitor name is required.').max(120),
  url: z.string().trim().url('Enter a full URL, e.g. https://example.com').optional().or(z.literal('')),
  positioning: z.string().trim().max(500).optional(),
  observations: z.string().trim().max(2000).optional(),
})

export async function addCompetitorAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('add-competitor', async () => {
    const ctx = await requireCtx()
    const input = competitorSchema.parse({
      name: formData.get('name') ?? '',
      url: formData.get('url') ?? '',
      positioning: formString(formData, 'positioning'),
      observations: formString(formData, 'observations'),
    })
    await addClientCompetitor(ctx, clientId, { ...input, url: input.url || undefined })
    revalidateClient(clientId)
    return actionOk(`${input.name} added to competitors.`)
  })
}

const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters.').max(120),
})

export async function createClientAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('create-client', async () => {
    const ctx = await requireCtx()
    const input = createClientSchema.parse({ name: formData.get('name') ?? '' })
    const client = await createClient(ctx, input)
    revalidatePath('/dashboard/clients')
    revalidatePath('/dashboard')
    return actionOk(`${client.name} created.`, { redirectTo: `/dashboard/clients/${client.id}` })
  })
}

// ---------------------------------------------------------------- recommendations / tasks / approvals

export async function acceptRecommendationAction(recommendationId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('accept-recommendation', async () => {
    const ctx = await requireCtx()
    await acceptRecommendation(ctx, recommendationId)
    revalidatePath('/dashboard/recommendations')
    revalidatePath('/dashboard/seo')
    revalidateClient(clientId)
    return actionOk('Recommendation accepted.')
  })
}

export async function rejectRecommendationAction(recommendationId: string, clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('reject-recommendation', async () => {
    const ctx = await requireCtx()
    const { reason } = reasonSchema.parse({ reason: formData.get('reason') ?? '' })
    await rejectRecommendation(ctx, recommendationId, reason)
    revalidatePath('/dashboard/recommendations')
    revalidatePath('/dashboard/seo')
    revalidateClient(clientId)
    return actionOk('Recommendation rejected. The reason was saved to the client\'s feedback history.')
  })
}

const TASK_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])

export async function updateTaskStatusAction(taskId: string, clientId: string, status: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('update-task', async () => {
    const ctx = await requireCtx()
    if (!TASK_STATUSES.has(status)) throw new Error('Invalid task status.')
    await updateTaskStatus(ctx, taskId, status as 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED')
    revalidatePath('/dashboard/tasks')
    revalidateClient(clientId)
    return actionOk(`Task marked ${status.toLowerCase().replace('_', ' ')}.`)
  })
}

export async function approveApprovalAction(approvalId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('approve', async () => {
    const ctx = await requireCtx()
    await approveAndExecuteApproval(ctx, approvalId)
    await syncContentCalendarItemFromApproval(approvalId)
    await syncCampaignFromApproval(approvalId)
    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/content-calendar')
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    revalidateClient(clientId)
    return actionOk('Approved and executed.')
  })
}

export async function rejectApprovalAction(approvalId: string, clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('reject-approval', async () => {
    const ctx = await requireCtx()
    const { reason } = reasonSchema.parse({ reason: formData.get('reason') ?? '' })
    await rejectApproval(ctx, approvalId, reason)
    await syncContentCalendarItemFromApproval(approvalId)
    await syncCampaignFromApproval(approvalId)
    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/content-calendar')
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    revalidateClient(clientId)
    return actionOk('Approval rejected.')
  })
}

// ---------------------------------------------------------------- integrations

const externalAccountSchema = z.object({
  externalAccountId: z.string().trim().min(1, 'The account id is required.').max(120),
  label: z.string().trim().max(120).optional(),
})

async function connectAction(
  context: string,
  clientId: string,
  formData: FormData,
  idField: string,
  connect: (ctx: Awaited<ReturnType<typeof requireCtx>>, id: string, label?: string) => Promise<unknown>,
  successMessage: string,
) {
  return runAction(context, async () => {
    const ctx = await requireCtx()
    const input = externalAccountSchema.parse({
      externalAccountId: formData.get(idField) ?? formData.get('externalAccountId') ?? '',
      label: formString(formData, 'label'),
    })
    await connect(ctx, input.externalAccountId, input.label)
    revalidateClient(clientId)
    revalidatePath('/dashboard/integrations')
    revalidatePath('/dashboard')
    return actionOk(successMessage)
  })
}

export async function connectMetricoolBrandAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return connectAction('connect-metricool', clientId, formData, 'brandId', (ctx, id, label) => connectClientToMetricoolBrand(ctx, clientId, id, label), 'Metricool brand connected. Health is verified on the first sync.')
}

export async function connectGoogleAdsAccountAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return connectAction('connect-google-ads', clientId, formData, 'externalAccountId', (ctx, id, label) => connectClientToGoogleAdsAccount(ctx, clientId, id, label), 'Google Ads account connected.')
}

export async function connectAmazonAdsAccountAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return connectAction('connect-amazon-ads', clientId, formData, 'externalAccountId', (ctx, id, label) => connectClientToAmazonAdsAccount(ctx, clientId, id, label), 'Amazon Ads account connected.')
}

export async function connectMetaAdsAccountAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('connect-meta-ads', async () => {
    const ctx = await requireCtx()
    const input = externalAccountSchema.parse({
      externalAccountId: formData.get('externalAccountId') ?? '',
      label: formString(formData, 'label'),
    })
    const accessToken = formString(formData, 'accessToken')
    await connectClientToMetaAdsAccount(ctx, clientId, input.externalAccountId, input.label, accessToken)
    revalidateClient(clientId)
    revalidatePath('/dashboard/integrations')
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    return actionOk('Meta Ads account connected and live telemetry synced.')
  })
}

export async function syncClientMetaAdsAction(clientId: string, connectionId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('sync-client-meta-ads', async () => {
    const ctx = await requireCtx()
    // Target this specific connection (a client can have several Meta Ads
    // accounts) rather than "whichever one is found first" - see
    // docs/DECISIONS.md, 2026-09-13.
    const result = await syncMetaAdAccountTelemetry(ctx, clientId, undefined, undefined, connectionId)
    revalidateClient(clientId)
    revalidatePath('/dashboard/integrations')
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    return actionOk(`Synced ${result.syncedCampaigns} Meta campaigns and ${result.syncedMetrics} daily metrics.`)
  })
}

export async function connectCanvaAccountAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return connectAction('connect-canva', clientId, formData, 'externalAccountId', (ctx, id, label) => connectClientToCanvaAccount(ctx, clientId, id, label), 'Canva brand connected.')
}

// ---------------------------------------------------------------- client Connections tab (structure-first social/web platforms)

/**
 * One generic connect action, parameterized by provider and bound per
 * platform card from the Connections tab (`connectClientConnectionAction
 * .bind(null, clientId, 'FACEBOOK')` etc.) - avoids eleven near-identical
 * wrapper functions for what's the same call with a different enum value.
 * See src/lib/integrations/connections.ts for why this never touches
 * providers with a real connect flow elsewhere (Metricool/Canva/Google
 * Ads/Meta Ads/GA4/GSC).
 */
export async function connectClientConnectionAction(
  clientId: string,
  provider: IntegrationProvider,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('connect-client-connection', async () => {
    const ctx = await requireCtx()
    const label = formString(formData, 'label') ?? ''
    await connectClientToPlaceholderAccount(ctx, clientId, provider, label)
    revalidateClient(clientId)
    return actionOk(`${PROVIDER_LABEL[provider]} connected.`)
  })
}

export async function disconnectClientConnectionAction(
  clientId: string,
  provider: IntegrationProvider,
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return runAction('disconnect-client-connection', async () => {
    const ctx = await requireCtx()
    await disconnectClientFromProvider(ctx, clientId, provider)
    revalidateClient(clientId)
    return actionOk(`${PROVIDER_LABEL[provider]} disconnected.`)
  })
}

// ---------------------------------------------------------------- content calendar

const contentItemSchema = z.object({
  platform: z.string().trim().min(1, 'Platform is required.').max(40),
  publishDate: z
    .string()
    .trim()
    .min(1, 'Publish date is required.')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid date.'),
  caption: z.string().trim().max(5000).optional(),
  creativeAssetId: z.string().trim().max(64).optional(),
})

export async function createContentItemAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('create-content-item', async () => {
    const ctx = await requireCtx()
    const input = contentItemSchema.parse({
      platform: formData.get('platform') ?? '',
      publishDate: formData.get('publishDate') ?? '',
      caption: formString(formData, 'caption'),
      creativeAssetId: formString(formData, 'creativeAssetId'),
    })
    await createContentCalendarItem(ctx, clientId, {
      platform: input.platform,
      publishDate: new Date(input.publishDate),
      caption: input.caption,
      creativeAssetId: input.creativeAssetId,
    })
    revalidatePath('/dashboard/content-calendar')
    revalidateClient(clientId)
    return actionOk('Added to the content calendar as a draft.')
  })
}

export async function quickSchedulePostAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('quick-schedule-post', async () => {
    const ctx = await requireCtx()
    const clientId = formData.get('clientId') as string
    if (!clientId) throw new Error('Client is required.')
    const platform = (formData.get('platform') as string) || 'instagram'
    const publishDateStr = formData.get('publishDate') as string
    const caption = formString(formData, 'caption')
    const creativeAssetId = formString(formData, 'creativeAssetId')

    const item = await createContentCalendarItem(ctx, clientId, {
      platform,
      publishDate: publishDateStr ? new Date(publishDateStr) : new Date(Date.now() + 86400000),
      caption,
      creativeAssetId,
    })

    if (formData.get('autoApprove') === 'on') {
      await submitContentForReview(ctx, item.id)
      await approveContentCalendarItem(ctx, item.id)
    }

    revalidatePath('/dashboard/content-calendar')
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/clients/${clientId}`)
    revalidatePath(`/portal/clients/${clientId}`)
    return actionOk(`Post scheduled for ${platform} successfully!`)
  })
}

export async function submitContentForReviewAction(itemId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('content-submit', async () => {
    const ctx = await requireCtx()
    await submitContentForReview(ctx, itemId)
    revalidatePath('/dashboard/content-calendar')
    revalidateClient(clientId)
    return actionOk('Submitted for review.')
  })
}

export async function approveContentItemAction(itemId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('content-approve', async () => {
    const ctx = await requireCtx()
    await approveContentCalendarItem(ctx, itemId)
    revalidatePath('/dashboard/content-calendar')
    revalidateClient(clientId)
    return actionOk('Post approved. Schedule it when ready.')
  })
}

export async function cancelContentItemAction(itemId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('content-cancel', async () => {
    const ctx = await requireCtx()
    await cancelContentCalendarItem(ctx, itemId)
    revalidatePath('/dashboard/content-calendar')
    revalidateClient(clientId)
    return actionOk('Post cancelled.')
  })
}

const networksSchema = z.object({
  networks: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/, 'Network names can only contain letters, numbers and underscores.'))
    .min(1, 'Choose at least one network.')
    .max(10),
})

export async function scheduleContentItemAction(itemId: string, clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('content-schedule', async () => {
    const ctx = await requireCtx()
    const raw = formData.getAll('networks').flatMap((v) => String(v).split(',')).map((n) => n.trim()).filter(Boolean)
    const { networks } = networksSchema.parse({ networks: raw })
    await scheduleContentCalendarItem(ctx, itemId, { networks })
    revalidatePath('/dashboard/content-calendar')
    revalidateClient(clientId)
    return actionOk(`Scheduled as a draft on ${networks.join(', ')}.`)
  })
}

export async function publishContentItemAction(itemId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('content-publish', async () => {
    const ctx = await requireCtx()
    await publishContentCalendarItem(ctx, itemId)
    revalidatePath('/dashboard/content-calendar')
    revalidatePath('/dashboard/approvals')
    revalidateClient(clientId)
    return actionOk('Publish requested. If approval is required it now appears under Approvals.')
  })
}

// ---------------------------------------------------------------- creatives

export async function submitCreativeForReviewAction(assetId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('creative-submit', async () => {
    const ctx = await requireCtx()
    await submitCreativeForReview(ctx, assetId)
    revalidatePath('/dashboard/creatives')
    revalidateClient(clientId)
    return actionOk('Submitted for review.')
  })
}

export async function approveCreativeAction(assetId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('creative-approve', async () => {
    const ctx = await requireCtx()
    await approveCreativeAsset(ctx, assetId)
    revalidatePath('/dashboard/creatives')
    revalidateClient(clientId)
    return actionOk('Creative approved. It can now be attached to a post.')
  })
}

export async function rejectCreativeAction(assetId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('creative-reject', async () => {
    const ctx = await requireCtx()
    await rejectCreativeAsset(ctx, assetId)
    revalidatePath('/dashboard/creatives')
    revalidateClient(clientId)
    return actionOk('Creative rejected.')
  })
}

export async function generateCreativeDesignAction(assetId: string, clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('creative-design', async () => {
    const ctx = await requireCtx()
    await generateCreativeDesign(ctx, assetId)
    revalidatePath('/dashboard/creatives')
    revalidateClient(clientId)
    return actionOk('Design generated. Open it in Canva to keep editing.')
  })
}

// ---------------------------------------------------------------- reports

export async function generateClientReportAction(internalReportId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('client-report', async () => {
    const ctx = await requireCtx()
    const derived = await generateClientReportFromInternal(ctx, internalReportId)
    revalidatePath('/dashboard/reports')
    revalidatePath(`/dashboard/reports/${internalReportId}`)
    revalidateClient(derived.clientId)
    return actionOk('Client-facing report generated.', { redirectTo: `/dashboard/reports/${derived.id}` })
  })
}

function revalidateClient(clientId: string) {
  revalidatePath(`/dashboard/clients/${clientId}`, 'layout')
}

// ---------------------------------------------------------------- notifications

export async function markNotificationReadAction(notificationId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('mark-notification-read', async () => {
    const ctx = await requireCtx()
    await markNotificationRead(ctx, notificationId)
    revalidatePath('/dashboard/notifications')
    revalidatePath('/dashboard', 'layout')
    return actionOk()
  })
}

export async function markAllNotificationsReadAction(_prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('mark-all-notifications-read', async () => {
    const ctx = await requireCtx()
    await markAllNotificationsRead(ctx)
    revalidatePath('/dashboard/notifications')
    revalidatePath('/dashboard', 'layout')
    return actionOk('All notifications marked as read.')
  })
}
