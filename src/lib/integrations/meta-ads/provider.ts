import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'
import {
  fetchMetaCampaigns,
  fetchMetaDailyInsights,
  pauseMetaCampaign,
  updateMetaCampaignBudget,
} from './meta-client'

function getAccessToken(explicitToken?: string): string {
  const token = explicitToken || process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_ACCESS_TOKEN
  if (!token) {
    throw new Error('Meta Ads API Access Token not configured (META_ACCESS_TOKEN).')
  }
  return token
}

/**
 * Production Meta Ads adapter communicating directly with Meta Graph API (v20.0).
 */
export function createMetaAdsProvider(explicitToken?: string): AdsProvider {
  const token = () => getAccessToken(explicitToken)

  return {
    async getCampaigns(adAccountId: string, channel: string): Promise<AdCampaignRecord[]> {
      const activeToken = token()
      const campaigns = await fetchMetaCampaigns(adAccountId, activeToken)
      return campaigns.map((c) => ({
        providerCampaignId: c.id,
        name: c.name,
        channel: channel || 'meta_ads',
        status: c.status,
        budget: c.dailyBudget ?? c.lifetimeBudget,
        startDate: c.startTime,
        endDate: c.stopTime,
      }))
    },

    async getCampaignPerformance(
      adAccountId: string,
      channel: string,
      range: { from: string; to: string },
    ): Promise<AdCampaignPerformance[]> {
      const activeToken = token()
      const insights = await fetchMetaDailyInsights(adAccountId, activeToken, {
        fromDate: range.from,
        toDate: range.to,
      })

      const now = new Date().toISOString()
      return insights.map((item) => ({
        source: 'meta_ads',
        retrievedAt: now,
        period: `${range.from}..${range.to}`,
        providerCampaignId: item.campaignId,
        spend: item.spend,
        impressions: item.impressions,
        clicks: item.clicks,
        ctr: item.ctr,
        cpc: item.cpc,
        cpm: item.cpm,
        conversions: item.conversions,
        conversionRate: item.clicks > 0 ? item.conversions / item.clicks : 0,
        cpa: item.conversions > 0 ? item.spend / item.conversions : 0,
        roas: item.roas,
        revenue: item.revenue,
        frequency: item.frequency,
        reach: item.reach,
        raw: item.raw,
      }))
    },

    async getAdGroups(): Promise<AdGroupRecord[]> {
      return []
    },

    async getAds(): Promise<AdRecord[]> {
      return []
    },

    async createCampaign(): Promise<AdCampaignRecord> {
      throw new Error('Direct Meta Campaign creation via Tool Registry is not yet supported. Use the AI Ad Studio.')
    },

    async updateCampaign(providerCampaignId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
      const activeToken = token()
      if (input.status === 'PAUSED') {
        await pauseMetaCampaign(providerCampaignId, activeToken)
      }
      if (input.budget !== undefined) {
        await updateMetaCampaignBudget(providerCampaignId, input.budget, activeToken)
      }
      return {
        providerCampaignId,
        name: input.name || 'Meta Campaign',
        channel: 'meta_ads',
        status: input.status,
        budget: input.budget,
      }
    },

    async pauseCampaign(providerCampaignId: string): Promise<void> {
      const activeToken = token()
      await pauseMetaCampaign(providerCampaignId, activeToken)
    },

    async updateBudget(providerCampaignId: string, budget: number): Promise<void> {
      const activeToken = token()
      await updateMetaCampaignBudget(providerCampaignId, budget, activeToken)
    },

    async updateBid(): Promise<void> {
      // Meta optimizes bids automatically through campaign budget optimization
    },
  }
}
