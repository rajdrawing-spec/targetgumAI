import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'
import {
  createAmazonCampaign,
  fetchAmazonAdGroups,
  fetchAmazonCampaignMetrics,
  fetchAmazonCampaigns,
  fetchAmazonProductAds,
  setAmazonCampaignState,
  updateAmazonAdGroupBid,
  updateAmazonCampaignBudget,
} from './amazon-ads-client'

function requireAccountId(accountId: string | undefined): string {
  if (!accountId) {
    throw new Error(
      'This Amazon Ads operation needs the target advertiser profile id - resolveAmazonAdsProvider(accountId) was called without one. See amazon-ads/tools.ts.',
    )
  }
  return accountId
}

/**
 * Production Amazon Ads adapter (Sponsored Products, API v3) - see
 * amazon-ads-client.ts's header comment for the full "not live-verified"
 * caveat. `resolveAmazonAdsProvider()` (./index.ts) only reaches this
 * adapter once `AMAZON_ADS_CLIENT_ID` is set; before that,
 * `AmazonAdsMockProvider` is what every amazon_ads.* tool exercises.
 *
 * Same shape as the Google Ads adapter for the same reason: every Amazon
 * Ads API call is scoped to an advertiser profile (sent as the
 * `Amazon-Advertising-API-Scope` header), unlike Meta's globally-
 * addressable campaign ids, so the shared `AdsProvider` interface's write
 * methods (which carry no account-id parameter) get it from this factory
 * argument instead - `amazon-ads/tools.ts` passes the connection's
 * `externalAccountId` (the profile id) when it builds a provider for a
 * write call.
 *
 * `updateBid`: Amazon Ads sets bids on an ad group's `defaultBid` (or a
 * keyword's own bid), never on an individual product ad - there is no
 * per-ad bid to change. `google_ads.update_bid`'s Tool Registry input is
 * `providerAdId` (the shared `AdsProvider` interface every provider
 * implements identically), so this treats that id as an ad group id, same
 * choice already made for Google Ads.
 */
export function createAmazonAdsProvider(accountId?: string): AdsProvider {
  return {
    async getCampaigns(profileId: string, channel: string): Promise<AdCampaignRecord[]> {
      const campaigns = await fetchAmazonCampaigns(profileId)
      return campaigns.map((c) => ({
        providerCampaignId: c.campaignId,
        name: c.name,
        channel: channel || 'amazon_ads',
        status: c.state,
        budget: c.dailyBudget,
        startDate: c.startDate,
        endDate: c.endDate,
      }))
    },

    async getCampaignPerformance(profileId: string, channel: string, range: { from: string; to: string }): Promise<AdCampaignPerformance[]> {
      const rows = await fetchAmazonCampaignMetrics(profileId, { fromDate: range.from, toDate: range.to })
      const now = new Date().toISOString()
      return rows.map((row) => {
        const revenue = row.sales
        const spend = row.cost
        return {
          source: 'amazon_ads',
          retrievedAt: now,
          period: row.date ?? `${range.from}..${range.to}`,
          providerCampaignId: row.campaignId,
          spend,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.impressions > 0 ? Number(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
          cpc: row.clicks > 0 ? Number((spend / row.clicks).toFixed(2)) : 0,
          conversions: row.purchases,
          conversionRate: row.clicks > 0 ? row.purchases / row.clicks : 0,
          cpa: row.purchases > 0 ? Number((spend / row.purchases).toFixed(2)) : 0,
          roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
          revenue,
          raw: row,
        }
      })
    },

    async getAdGroups(profileId: string, providerCampaignId: string): Promise<AdGroupRecord[]> {
      const adGroups = await fetchAmazonAdGroups(profileId, providerCampaignId)
      return adGroups.map((ag) => ({ providerAdGroupId: ag.adGroupId, providerCampaignId, name: ag.name }))
    },

    async getAds(profileId: string, providerAdGroupId: string): Promise<AdRecord[]> {
      const ads = await fetchAmazonProductAds(profileId, providerAdGroupId)
      return ads.map((ad) => ({ providerAdId: ad.adId, providerAdGroupId, name: ad.sku || ad.asin || ad.adId }))
    },

    async createCampaign(profileId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
      if (!input.name) throw new Error('A campaign name is required.')
      const created = await createAmazonCampaign(profileId, { name: input.name, budget: input.budget })
      return {
        providerCampaignId: created.campaignId,
        name: created.name,
        channel: 'amazon_ads',
        status: created.state,
        budget: created.dailyBudget,
      }
    },

    async updateCampaign(providerCampaignId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
      const profileId = requireAccountId(accountId)
      if (input.status === 'PAUSED') {
        await setAmazonCampaignState(profileId, providerCampaignId, 'paused')
      } else if (input.status === 'ACTIVE' || input.status === 'ENABLED') {
        await setAmazonCampaignState(profileId, providerCampaignId, 'enabled')
      }
      if (input.budget !== undefined) {
        await updateAmazonCampaignBudget(profileId, providerCampaignId, input.budget)
      }
      return {
        providerCampaignId,
        name: input.name || 'Amazon Sponsored Products Campaign',
        channel: 'amazon_ads',
        status: input.status,
        budget: input.budget,
      }
    },

    async pauseCampaign(providerCampaignId: string): Promise<void> {
      await setAmazonCampaignState(requireAccountId(accountId), providerCampaignId, 'paused')
    },

    async updateBudget(providerCampaignId: string, budget: number): Promise<void> {
      await updateAmazonCampaignBudget(requireAccountId(accountId), providerCampaignId, budget)
    },

    async updateBid(providerAdGroupId: string, bid: number): Promise<void> {
      await updateAmazonAdGroupBid(requireAccountId(accountId), providerAdGroupId, bid)
    },
  }
}
