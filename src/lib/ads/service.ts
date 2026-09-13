import { db } from '@/lib/db/client'
import { assertClientAccess } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { executeTool } from '@/lib/tools/execute'
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
 * Pausing a META_ADS campaign calls the real Graph API (`meta_ads.
 * pause_campaign`, MEDIUM risk - spend-reducing, executes immediately, no
 * approval) before the local row is flipped, so this button actually stops
 * spend on Meta instead of only changing what TargetGum displays. Resuming
 * a campaign is the higher-risk direction (BRD Section 21 treats it like
 * "launch campaign") and goes through `meta_ads.update_campaign`, which is
 * HIGH risk and approval-gated - that can't complete synchronously inside
 * this one-click toggle without a UI for the pending state, so for now
 * Resume (and every non-Meta provider, in both directions) stays a local
 * status change only. See docs/DECISIONS.md.
 */
export async function toggleCampaignStatus(ctx: AuthContext, campaignId: string, currentStatus: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) throw new Error('Campaign not found')
  assertClientAccess(ctx, { id: campaign.clientId, organizationId: ctx.organizationId })

  const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'

  if (newStatus === 'PAUSED' && campaign.provider === 'META_ADS') {
    await executeTool({
      ctx,
      toolKey: 'meta_ads.pause_campaign',
      clientId: campaign.clientId,
      input: { providerCampaignId: campaign.providerCampaignId },
    })
  }

  return db.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  })
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
