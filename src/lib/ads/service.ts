import { db } from '@/lib/db/client'
import { assertClientAccess } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
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

  // Create initial baseline metrics for simulation & analysis
  const initialImpressions = Math.floor(Math.random() * 5000) + 1200
  const initialClicks = Math.floor(initialImpressions * (0.02 + Math.random() * 0.04))
  const initialCpc = input.defaultBid ?? (1.2 + Math.random() * 0.8)
  const initialSpend = Number((initialClicks * initialCpc).toFixed(2))
  const initialConversions = Math.max(1, Math.floor(initialClicks * 0.08))
  const initialRevenue = Number((initialConversions * (35 + Math.random() * 50)).toFixed(2))
  const roas = initialSpend > 0 ? initialRevenue / initialSpend : 0

  await db.campaignMetric.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: input.clientId,
      campaignId: campaign.id,
      date: new Date(),
      source: input.provider,
      retrievedAt: new Date(),
      period: 'daily',
      impressions: initialImpressions,
      clicks: initialClicks,
      spend: initialSpend,
      ctr: initialImpressions > 0 ? Number(((initialClicks / initialImpressions) * 100).toFixed(4)) : 0,
      cpc: Number(initialCpc.toFixed(4)),
      conversions: initialConversions,
      revenue: initialRevenue,
      roas: Number(roas.toFixed(4)),
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

export async function toggleCampaignStatus(ctx: AuthContext, campaignId: string, currentStatus: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) throw new Error('Campaign not found')
  assertClientAccess(ctx, { id: campaign.clientId, organizationId: ctx.organizationId })

  const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
  return db.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  })
}

export async function seedDemoAdsData(ctx: AuthContext, targetClientId?: string) {
  // Find a target client if none specified
  let clientId = targetClientId
  if (!clientId) {
    const accessible = await db.client.findFirst({
      where: {
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
      },
    })
    if (!accessible) throw new Error('No active client found to attach demo ad campaigns')
    clientId = accessible.id
  }

  const demoCampaigns = [
    {
      name: 'Amazon PPC - Sponsored Products (Core ASINs)',
      provider: 'AMAZON_ADS' as IntegrationProvider,
      channel: 'Sponsored Products - Manual Keywords',
      budget: 1500,
      impressions: 48250,
      clicks: 1640,
      spend: 1420.50,
      conversions: 184,
      revenue: 6850.00,
      targetAcos: 22,
    },
    {
      name: 'Amazon PPC - Sponsored Brands (Brand Defense)',
      provider: 'AMAZON_ADS' as IntegrationProvider,
      channel: 'Sponsored Brands - Video & Store',
      budget: 800,
      impressions: 29400,
      clicks: 810,
      spend: 645.20,
      conversions: 92,
      revenue: 3420.00,
      targetAcos: 20,
    },
    {
      name: 'Google Ads - High Intent Search (Purchase Queries)',
      provider: 'GOOGLE_ADS' as IntegrationProvider,
      channel: 'Google Search Network',
      budget: 2200,
      impressions: 62100,
      clicks: 2950,
      spend: 2180.00,
      conversions: 240,
      revenue: 9640.00,
      targetAcos: 24,
    },
    {
      name: 'Meta Ads - Retargeting & Lookalike Audiences',
      provider: 'META_ADS' as IntegrationProvider,
      channel: 'Instagram & Facebook Feed',
      budget: 1200,
      impressions: 94800,
      clicks: 2180,
      spend: 1140.00,
      conversions: 115,
      revenue: 4280.00,
      targetAcos: 28,
    },
  ]

  for (const c of demoCampaigns) {
    const providerCampaignId = `demo_${c.provider.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`
    const created = await db.campaign.create({
      data: {
        organizationId: ctx.organizationId,
        clientId,
        provider: c.provider,
        providerCampaignId,
        name: c.name,
        channel: c.channel,
        status: 'ACTIVE',
        budget: c.budget,
        startDate: new Date(Date.now() - 30 * 86400000),
      },
    })

    const ctr = (c.clicks / c.impressions) * 100
    const cpc = c.spend / c.clicks
    const roas = c.revenue / c.spend

    await db.campaignMetric.create({
      data: {
        organizationId: ctx.organizationId,
        clientId,
        campaignId: created.id,
        date: new Date(),
        source: c.provider,
        retrievedAt: new Date(),
        period: '30d',
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        ctr: Number(ctr.toFixed(4)),
        cpc: Number(cpc.toFixed(4)),
        conversions: c.conversions,
        revenue: c.revenue,
        roas: Number(roas.toFixed(4)),
        raw: {
          targetAcos: c.targetAcos,
          isDemo: true,
        },
      },
    })
  }

  return true
}
