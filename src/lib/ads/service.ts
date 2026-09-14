import { db } from '@/lib/db/client'
import { assertClientAccess } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { executeTool } from '@/lib/tools/execute'
import { ApprovalRequiredError } from '@/lib/tools/errors'
import type { IntegrationProvider } from '@prisma/client'
import type { CreateCampaignInput, CampaignSummary } from './types'

export async function listCampaigns(ctx: AuthContext, clientId?: string): Promise<CampaignSummary[]> {
  if (clientId) {
    assertClientAccess(ctx, { id: clientId, organizationId: ctx.organizationId })
  }

  const whereClause: any = {
    organizationId: ctx.organizationId,
  }

  if (clientId) {
    whereClause.clientId = clientId
  } else if (ctx.clientAccess.kind === 'SET') {
    whereClause.clientId = { in: Array.from(ctx.clientAccess.clientIds) }
  }

  const campaigns = await db.campaign.findMany({
    where: whereClause,
    include: {
      client: { select: { id: true, name: true } },
      metrics: {
        orderBy: { date: 'desc' },
        take: 30,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return campaigns.map((c) => {
    // Sum metrics
    let impressions = 0
    let clicks = 0
    let spend = 0
    let conversions = 0
    let revenue = 0

    for (const m of c.metrics) {
      impressions += m.impressions ?? 0
      clicks += m.clicks ?? 0
      spend += Number(m.spend ?? 0)
      conversions += m.conversions ?? 0
      revenue += Number(m.revenue ?? 0)
    }

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    const roas = spend > 0 ? revenue / spend : 0
    const acos = revenue > 0 ? (spend / revenue) * 100 : 0

    return {
      id: c.id,
      clientId: c.clientId,
      clientName: c.client.name,
      name: c.name,
      provider: c.provider,
      channel: c.channel,
      status: c.status ?? 'ACTIVE',
      approvalId: c.approvalId,
      budget: Number(c.budget ?? 0),
      metrics: {
        impressions,
        clicks,
        spend,
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2)),
        conversions,
        revenue: Number(revenue.toFixed(2)),
        roas: Number(roas.toFixed(2)),
        acos: Number(acos.toFixed(2)),
      },
      createdAt: c.createdAt,
    }
  })
}

export async function createCampaign(ctx: AuthContext, input: CreateCampaignInput) {
  assertClientAccess(ctx, { id: input.clientId, organizationId: ctx.organizationId })

  const providerCampaignId = `${input.provider.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const campaign = await db.campaign.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: input.clientId,
      provider: input.provider,
      providerCampaignId,
      name: input.name,
      channel: input.channel ?? (input.provider === 'AMAZON_ADS' ? 'Amazon Sponsored Products' : 'Search'),
      status: input.status ?? 'ACTIVE',
      budget: input.budget,
      startDate: input.startDate ?? new Date(),
    },
  })

  // Newly created campaign starts clean with zero metrics until genuine telemetry streams from the ad platform
  await db.campaignMetric.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: input.clientId,
      campaignId: campaign.id,
      date: new Date(),
      source: input.provider,
      retrievedAt: new Date(),
      period: 'initial',
      impressions: 0,
      clicks: 0,
      spend: 0,
      ctr: 0,
      cpc: 0,
      conversions: 0,
      revenue: 0,
      roas: 0,
      raw: {
        targetAcos: input.targetAcos,
        amazonType: input.amazonType,
        amazonTargeting: input.amazonTargeting,
        keywords: input.keywords,
        negativeKeywords: input.negativeKeywords,
        adCopy: input.adCopy,
      },
    },
  })

  return campaign
}

/**
 * The pause/resume tool keys for providers with a real, write-capable
 * `AdsProvider` adapter - both Meta Ads and Google Ads as of 2026-09-14
 * (see docs/DECISIONS.md). A provider absent from this map (Amazon Ads: no
 * adapter exists yet) falls through to a local-only status change, same as
 * before either adapter went live.
 */
const REAL_PAUSE_RESUME_TOOLS: Partial<Record<IntegrationProvider, { pause: string; resume: string }>> = {
  META_ADS: { pause: 'meta_ads.pause_campaign', resume: 'meta_ads.update_campaign' },
  GOOGLE_ADS: { pause: 'google_ads.pause_campaign', resume: 'google_ads.update_campaign' },
}

/**
 * Pausing a campaign on a real, connected provider calls the real API
 * (`{provider}.pause_campaign`, MEDIUM risk - spend-reducing, executes
 * immediately, no approval) before the local row is flipped, so this
 * button actually stops spend on the platform instead of only changing
 * what TargetGum displays.
 *
 * Resuming is the higher-risk direction - BRD Section 21 treats
 * re-activating a campaign like "launch campaign", HIGH risk, approval-
 * required - so it goes through `{provider}.update_campaign` instead, which
 * never executes on this call: `executeTool` creates a PENDING Approval and
 * throws `ApprovalRequiredError`, which this catches to record the
 * approval id on the campaign (status stays PAUSED - it's still exactly
 * what it was, just now also waiting on a human). Calling this again while
 * one is already pending is refused rather than opening a second approval
 * for the same resume. Once an approver acts on it
 * (`approveAndExecuteApproval`), `syncCampaignFromApproval` (called right
 * after, from the dashboard Server Action - same pattern as
 * `syncContentCalendarItemFromApproval`) reconciles the row. A provider
 * with no entry in `REAL_PAUSE_RESUME_TOOLS` stays a local status change
 * only, in both directions.
 */
export async function toggleCampaignStatus(ctx: AuthContext, campaignId: string, currentStatus: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) throw new Error('Campaign not found')
  assertClientAccess(ctx, { id: campaign.clientId, organizationId: ctx.organizationId })

  const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
  const realTools = REAL_PAUSE_RESUME_TOOLS[campaign.provider]

  if (newStatus === 'PAUSED' && realTools) {
    await executeTool({
      ctx,
      toolKey: realTools.pause,
      clientId: campaign.clientId,
      input: { providerCampaignId: campaign.providerCampaignId },
    })
    return db.campaign.update({ where: { id: campaignId }, data: { status: newStatus } })
  }

  if (newStatus === 'ACTIVE' && realTools) {
    if (campaign.approvalId) {
      throw new Error('A resume request is already pending approval for this campaign.')
    }
    try {
      await executeTool({
        ctx,
        toolKey: realTools.resume,
        clientId: campaign.clientId,
        input: { providerCampaignId: campaign.providerCampaignId, status: 'ACTIVE' },
      })
      // A HIGH-risk tool call never reaches this line on a fresh (non-approved) call - reaching it means the risk gate didn't fire.
      throw new Error(`${realTools.resume} executed without an approval - the HIGH-risk gate should have blocked this.`)
    } catch (error) {
      if (error instanceof ApprovalRequiredError) {
        return db.campaign.update({ where: { id: campaignId }, data: { approvalId: error.approvalId } })
      }
      throw error
    }
  }

  return db.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  })
}

/**
 * Called right after an approver approves+executes or rejects a campaign
 * resume approval (`approveAndExecuteApproval`/`rejectApproval`,
 * src/lib/tools/execute.ts and src/lib/approvals/approvals.ts) - not
 * itself permission-gated, since it only runs as a side effect of an
 * action that was already authorized. A no-op for any approval that isn't
 * linked to a campaign. Broader than `syncContentCalendarItemFromApproval`
 * in one respect: an EXPIRED or CANCELLED approval also clears
 * `approvalId` so the Ads Hub toggle doesn't get stuck showing "awaiting
 * approval" forever - EXECUTED is the only outcome that changes `status`.
 */
export async function syncCampaignFromApproval(approvalId: string): Promise<void> {
  const campaign = await db.campaign.findFirst({ where: { approvalId } })
  if (!campaign) return

  const approval = await db.approval.findUnique({ where: { id: approvalId } })
  if (!approval) return

  if (approval.status === 'EXECUTED') {
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'ACTIVE', approvalId: null } })
  } else if (approval.status === 'FAILED' || approval.status === 'REJECTED' || approval.status === 'EXPIRED' || approval.status === 'CANCELLED') {
    await db.campaign.update({ where: { id: campaign.id }, data: { approvalId: null } })
  }
}

/**
 * Purges any demo/mock campaigns and seeded pilot clients so only genuine
 * client data remains in the database.
 */
export async function purgeAllDummyData(ctx: AuthContext) {
  // 1. Delete all demo campaigns with providerCampaignId starting with 'demo_'
  await db.campaign.deleteMany({
    where: {
      organizationId: ctx.organizationId,
      providerCampaignId: { startsWith: 'demo_' },
    },
  })

  // 2. Delete dummy clients (Client A pilot, Client B) if present
  const dummyClients = await db.client.findMany({
    where: {
      organizationId: ctx.organizationId,
      slug: { in: ['client-a', 'client-b'] },
    },
    select: { id: true },
  })

  if (dummyClients.length > 0) {
    const dummyIds = dummyClients.map((c) => c.id)
    await db.client.deleteMany({
      where: { id: { in: dummyIds } },
    })
  }

  return { purgedClients: dummyClients.length }
}
