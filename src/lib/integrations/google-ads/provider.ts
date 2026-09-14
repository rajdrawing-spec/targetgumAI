import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'
import {
  createGoogleAdsCampaign,
  fetchGoogleAdsAdGroups,
  fetchGoogleAdsAds,
  fetchGoogleAdsCampaignMetrics,
  fetchGoogleAdsCampaigns,
  fromMicros,
  setGoogleAdsCampaignStatus,
  updateGoogleAdsAdGroupCpcBid,
  updateGoogleAdsCampaignBudget,
} from './google-ads-client'

function requireAccountId(accountId: string | undefined): string {
  if (!accountId) {
    throw new Error(
      'This Google Ads operation needs the target customer account id - resolveGoogleAdsProvider(accountId) was called without one. See google-ads/tools.ts.',
    )
  }
  return accountId
}

/**
 * Production Google Ads adapter, communicating directly with the Google
 * Ads API (v18, REST + GAQL) - see google-ads-client.ts's header comment
 * for the full "not live-verified" caveat and exactly which two details are
 * most likely to need a one-line fix once a real developer token exists
 * (docs/EXTERNAL-APPROVALS.md). `resolveGoogleAdsProvider()` (./index.ts)
 * only reaches this adapter once `GOOGLE_ADS_DEVELOPER_TOKEN` is set;
 * before that, `GoogleAdsMockProvider` is what every google_ads.* tool
 * actually exercises.
 *
 * Every Google Ads API call is scoped to a customer account
 * (`/customers/{id}/...` is in the URL path itself), unlike Meta's Graph
 * API where a campaign id is globally addressable - `pauseCampaign`/
 * `updateBudget`/`updateBid`/`updateCampaign` on the shared `AdsProvider`
 * interface don't carry an account id parameter (Meta/Metricool never
 * needed one), so this adapter takes it here instead, as an argument to
 * the factory itself - same shape Meta's `createMetaAdsProvider(token)`
 * already uses for its own per-call context. `google-ads/tools.ts` passes
 * the connection's `externalAccountId` when it builds this provider for a
 * write call.
 *
 * `updateBid`: Google Ads sets bids on an ad group (or a keyword), never on
 * an individual ad - there is no per-ad bid to change. The Tool Registry's
 * `google_ads.update_bid` input is `providerAdId` (matching the shared
 * `AdsProvider` interface every provider implements identically), so this
 * treats that id as an ad group id. If ad-group-level automation ever needs
 * its own distinct id shape, that's a Tool Registry input change, not a
 * provider one.
 */
export function createGoogleAdsProvider(accountId?: string): AdsProvider {
  return {
    async getCampaigns(customerId: string, channel: string): Promise<AdCampaignRecord[]> {
      const campaigns = await fetchGoogleAdsCampaigns(customerId)
      return campaigns.map((c) => ({
        providerCampaignId: c.id,
        name: c.name,
        channel: channel || 'google_ads',
        status: c.status,
        budget: c.budgetMicros !== undefined ? fromMicros(c.budgetMicros) : undefined,
        startDate: c.startDate,
        endDate: c.endDate,
      }))
    },

    async getCampaignPerformance(
      customerId: string,
      channel: string,
      range: { from: string; to: string },
    ): Promise<AdCampaignPerformance[]> {
      const rows = await fetchGoogleAdsCampaignMetrics(customerId, { fromDate: range.from, toDate: range.to })
      const now = new Date().toISOString()
      return rows.map((row) => {
        const spend = fromMicros(row.costMicros)
        const revenue = row.conversionsValue
        return {
          source: 'google_ads',
          retrievedAt: now,
          period: row.date ?? `${range.from}..${range.to}`,
          providerCampaignId: row.campaignId,
          spend,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr * 100, // Google Ads' GAQL `metrics.ctr` is a 0-1 ratio; this app's convention is a percentage (matches the Meta adapter).
          cpc: fromMicros(row.averageCpcMicros),
          conversions: row.conversions,
          conversionRate: row.clicks > 0 ? row.conversions / row.clicks : 0,
          cpa: row.conversions > 0 ? spend / row.conversions : 0,
          roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
          revenue,
          raw: row,
        }
      })
    },

    async getAdGroups(customerId: string, providerCampaignId: string): Promise<AdGroupRecord[]> {
      const adGroups = await fetchGoogleAdsAdGroups(customerId, providerCampaignId)
      return adGroups.map((ag) => ({ providerAdGroupId: ag.id, providerCampaignId, name: ag.name }))
    },

    async getAds(customerId: string, providerAdGroupId: string): Promise<AdRecord[]> {
      const ads = await fetchGoogleAdsAds(customerId, providerAdGroupId)
      return ads.map((ad) => ({ providerAdId: ad.id, providerAdGroupId, name: ad.name }))
    },

    async createCampaign(customerId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
      if (!input.name) throw new Error('A campaign name is required.')
      const created = await createGoogleAdsCampaign(customerId, { name: input.name, budget: input.budget })
      return {
        providerCampaignId: created.id,
        name: created.name,
        channel: 'google_ads',
        status: created.status,
        budget: created.budgetMicros !== undefined ? fromMicros(created.budgetMicros) : undefined,
      }
    },

    async updateCampaign(providerCampaignId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
      const customerId = requireAccountId(accountId)
      if (input.status === 'PAUSED') {
        await setGoogleAdsCampaignStatus(customerId, providerCampaignId, 'PAUSED')
      } else if (input.status === 'ACTIVE' || input.status === 'ENABLED') {
        await setGoogleAdsCampaignStatus(customerId, providerCampaignId, 'ENABLED')
      }
      if (input.budget !== undefined) {
        await updateGoogleAdsCampaignBudget(customerId, providerCampaignId, input.budget)
      }
      return {
        providerCampaignId,
        name: input.name || 'Google Ads Campaign',
        channel: 'google_ads',
        status: input.status,
        budget: input.budget,
      }
    },

    async pauseCampaign(providerCampaignId: string): Promise<void> {
      await setGoogleAdsCampaignStatus(requireAccountId(accountId), providerCampaignId, 'PAUSED')
    },

    async updateBudget(providerCampaignId: string, budget: number): Promise<void> {
      await updateGoogleAdsCampaignBudget(requireAccountId(accountId), providerCampaignId, budget)
    },

    async updateBid(providerAdGroupId: string, bid: number): Promise<void> {
      await updateGoogleAdsAdGroupCpcBid(requireAccountId(accountId), providerAdGroupId, bid)
    },
  }
}
