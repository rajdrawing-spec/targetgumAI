import { randomUUID } from 'crypto'
import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'

/**
 * Full mock implementation of `AdsProvider` for the native Meta Ads
 * integration (BRD-PRD Section 92 explicitly names `MetaAdsMockProvider`)
 * - deterministic, in-memory, no network. Same shape as
 * `GoogleAdsMockProvider`/`MetricoolMockProvider`'s ads section - see
 * either for the general pattern this follows.
 *
 * `createCampaign` always returns a `PAUSED` campaign, same reasoning as
 * `GoogleAdsMockProvider.createCampaign` (BRD Section 21: "create draft
 * campaign" is MEDIUM, "launch campaign" is HIGH - actually launching is a
 * separate, HIGH-risk `updateCampaign` call).
 */
class MockState {
  campaigns = new Map<string, AdCampaignRecord>([
    [
      'mock-meta-campaign-1',
      { providerCampaignId: 'mock-meta-campaign-1', name: 'Mock Conversions - Retargeting', channel: 'meta_ads', status: 'ACTIVE', budget: 35 },
    ],
    [
      'mock-meta-campaign-2',
      { providerCampaignId: 'mock-meta-campaign-2', name: 'Mock Reach - Lookalike', channel: 'meta_ads', status: 'ACTIVE', budget: 50 },
    ],
  ])
  adGroups = new Map<string, AdGroupRecord>([
    [
      'mock-meta-adset-1',
      { providerAdGroupId: 'mock-meta-adset-1', providerCampaignId: 'mock-meta-campaign-1', name: 'Mock Ad Set - 25-45 Interest' },
    ],
  ])
  ads = new Map<string, AdRecord>([
    ['mock-meta-ad-1', { providerAdId: 'mock-meta-ad-1', providerAdGroupId: 'mock-meta-adset-1', name: 'Mock Carousel Ad' }],
  ])
}

const state = new MockState()

export const MetaAdsMockProvider: AdsProvider = {
  async getCampaigns(_brandId, channel): Promise<AdCampaignRecord[]> {
    return Array.from(state.campaigns.values()).filter((c) => c.channel === channel)
  },

  async getCampaignPerformance(_brandId, channel, range): Promise<AdCampaignPerformance[]> {
    const now = new Date().toISOString()
    return Array.from(state.campaigns.values())
      .filter((c) => c.channel === channel)
      .map((c) => ({
        source: 'meta-ads-mock',
        retrievedAt: now,
        period: `${range.from}..${range.to}`,
        providerCampaignId: c.providerCampaignId,
        spend: 268.9,
        impressions: 61000,
        clicks: 780,
        ctr: 0.0128,
        cpc: 0.34,
        cpm: 4.41,
        conversions: 19,
        conversionRate: 0.0244,
        cpa: 14.15,
        roas: 2.9,
        revenue: 779.81,
        frequency: 1.8,
        reach: 33900,
        raw: { mock: true },
      }))
  },

  async getAdGroups(_brandId, providerCampaignId): Promise<AdGroupRecord[]> {
    return Array.from(state.adGroups.values()).filter((g) => g.providerCampaignId === providerCampaignId)
  },

  async getAds(_brandId, providerAdGroupId): Promise<AdRecord[]> {
    return Array.from(state.ads.values()).filter((a) => a.providerAdGroupId === providerAdGroupId)
  },

  async createCampaign(_brandId, input): Promise<AdCampaignRecord> {
    const campaign: AdCampaignRecord = {
      providerCampaignId: randomUUID(),
      name: input.name ?? 'Mock Meta Ads Campaign',
      channel: 'meta_ads',
      status: 'PAUSED', // always created paused - see doc comment above
      budget: input.budget,
    }
    state.campaigns.set(campaign.providerCampaignId, campaign)
    return campaign
  },

  async updateCampaign(providerCampaignId, input): Promise<AdCampaignRecord> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Meta Ads campaign with id "${providerCampaignId}".`)
    Object.assign(campaign, input)
    return campaign
  },

  async pauseCampaign(providerCampaignId): Promise<void> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Meta Ads campaign with id "${providerCampaignId}".`)
    campaign.status = 'PAUSED'
  },

  async updateBudget(providerCampaignId, budget): Promise<void> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Meta Ads campaign with id "${providerCampaignId}".`)
    campaign.budget = budget
  },

  async updateBid(): Promise<void> {
    // No per-ad bid state in this mock, same simplification MetricoolMockProvider makes - accepted as a no-op.
  },
}
