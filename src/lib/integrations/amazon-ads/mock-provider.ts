import { randomUUID } from 'crypto'
import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'

/**
 * Full mock implementation of `AdsProvider` for the native Amazon Ads
 * (Sponsored Products) integration - deterministic, in-memory, no
 * network, same shape as `GoogleAdsMockProvider`/`MetaAdsMockProvider`.
 * What every `amazon_ads.*` tool, agent, and test exercises when
 * `AMAZON_ADS_CLIENT_ID` isn't set.
 *
 * `createCampaign` always returns a `paused` campaign, never `enabled` -
 * same BRD Section 21 reasoning as every other provider's mock.
 */
class MockState {
  campaigns = new Map<string, AdCampaignRecord>([
    [
      'mock-amzn-campaign-1',
      { providerCampaignId: 'mock-amzn-campaign-1', name: 'Mock Sponsored Products - Auto', channel: 'amazon_ads', status: 'enabled', budget: 25 },
    ],
    [
      'mock-amzn-campaign-2',
      { providerCampaignId: 'mock-amzn-campaign-2', name: 'Mock Sponsored Products - Exact', channel: 'amazon_ads', status: 'enabled', budget: 50 },
    ],
  ])
  adGroups = new Map<string, AdGroupRecord>([
    ['mock-amzn-adgroup-1', { providerAdGroupId: 'mock-amzn-adgroup-1', providerCampaignId: 'mock-amzn-campaign-1', name: 'Mock Ad Group - Core ASINs' }],
  ])
  ads = new Map<string, AdRecord>([
    ['mock-amzn-ad-1', { providerAdId: 'mock-amzn-ad-1', providerAdGroupId: 'mock-amzn-adgroup-1', name: 'Mock Product Ad - B0MOCK1234' }],
  ])
}

const state = new MockState()

export const AmazonAdsMockProvider: AdsProvider = {
  async getCampaigns(_profileId, channel): Promise<AdCampaignRecord[]> {
    return Array.from(state.campaigns.values()).filter((c) => c.channel === channel)
  },

  async getCampaignPerformance(_profileId, channel, range): Promise<AdCampaignPerformance[]> {
    const now = new Date().toISOString()
    return Array.from(state.campaigns.values())
      .filter((c) => c.channel === channel)
      .map((c) => ({
        source: 'amazon-ads-mock',
        retrievedAt: now,
        period: `${range.from}..${range.to}`,
        providerCampaignId: c.providerCampaignId,
        spend: 180.5,
        impressions: 21000,
        clicks: 310,
        ctr: 1.48,
        cpc: 0.58,
        conversions: 18,
        conversionRate: 0.058,
        cpa: 10.03,
        roas: 4.2,
        revenue: 758.1,
        raw: { mock: true },
      }))
  },

  async getAdGroups(_profileId, providerCampaignId): Promise<AdGroupRecord[]> {
    return Array.from(state.adGroups.values()).filter((g) => g.providerCampaignId === providerCampaignId)
  },

  async getAds(_profileId, providerAdGroupId): Promise<AdRecord[]> {
    return Array.from(state.ads.values()).filter((a) => a.providerAdGroupId === providerAdGroupId)
  },

  async createCampaign(_profileId, input): Promise<AdCampaignRecord> {
    const campaign: AdCampaignRecord = {
      providerCampaignId: randomUUID(),
      name: input.name ?? 'Mock Amazon Sponsored Products Campaign',
      channel: 'amazon_ads',
      status: 'paused', // always created paused - see doc comment above
      budget: input.budget,
    }
    state.campaigns.set(campaign.providerCampaignId, campaign)
    return campaign
  },

  async updateCampaign(providerCampaignId, input): Promise<AdCampaignRecord> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Amazon Ads campaign with id "${providerCampaignId}".`)
    Object.assign(campaign, input)
    return campaign
  },

  async pauseCampaign(providerCampaignId): Promise<void> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Amazon Ads campaign with id "${providerCampaignId}".`)
    campaign.status = 'paused'
  },

  async updateBudget(providerCampaignId, budget): Promise<void> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Amazon Ads campaign with id "${providerCampaignId}".`)
    campaign.budget = budget
  },

  async updateBid(): Promise<void> {
    // No per-ad-group bid state in this mock, same simplification GoogleAdsMockProvider/MetricoolMockProvider make - accepted as a no-op.
  },
}
