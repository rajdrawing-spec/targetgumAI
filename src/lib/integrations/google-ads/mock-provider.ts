import { randomUUID } from 'crypto'
import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'

/**
 * Full mock implementation of `AdsProvider` for the native Google Ads
 * integration (BRD-PRD Section 92 explicitly names `GoogleAdsMockProvider`)
 * - deterministic, in-memory, no network, closing the "ad management
 * (write)" gap `docs/INTEGRATIONS.md` documents as confirmed unavailable
 * via Metricool. Same shape as `MetricoolMockProvider`'s ads section
 * (`src/lib/integrations/metricool/mock-provider.ts`), just as a full
 * standalone provider rather than a stand-in inside another one.
 *
 * `createCampaign` always returns a `PAUSED` campaign, never `ENABLED` -
 * mirrors Metricool's `schedulePost` always sending `draft: true`: BRD
 * Section 21 classifies "create draft campaign" MEDIUM (default automatic)
 * but "launch campaign" HIGH (approval required) - actually enabling a
 * freshly created campaign is a separate `updateCampaign` call, gated
 * accordingly by the Tool Registry entry that calls it
 * (`src/lib/integrations/google-ads/tools.ts`), not something this method
 * does implicitly.
 */
class MockState {
  campaigns = new Map<string, AdCampaignRecord>([
    [
      'mock-gads-campaign-1',
      { providerCampaignId: 'mock-gads-campaign-1', name: 'Mock Search - Brand', channel: 'google_ads', status: 'ENABLED', budget: 40 },
    ],
    [
      'mock-gads-campaign-2',
      { providerCampaignId: 'mock-gads-campaign-2', name: 'Mock Performance Max', channel: 'google_ads', status: 'ENABLED', budget: 75 },
    ],
  ])
  adGroups = new Map<string, AdGroupRecord>([
    [
      'mock-gads-adgroup-1',
      { providerAdGroupId: 'mock-gads-adgroup-1', providerCampaignId: 'mock-gads-campaign-1', name: 'Mock Ad Group - Exact Match' },
    ],
  ])
  ads = new Map<string, AdRecord>([
    ['mock-gads-ad-1', { providerAdId: 'mock-gads-ad-1', providerAdGroupId: 'mock-gads-adgroup-1', name: 'Mock Responsive Search Ad' }],
  ])
}

const state = new MockState()

export const GoogleAdsMockProvider: AdsProvider = {
  async getCampaigns(_brandId, channel): Promise<AdCampaignRecord[]> {
    return Array.from(state.campaigns.values()).filter((c) => c.channel === channel)
  },

  async getCampaignPerformance(_brandId, channel, range): Promise<AdCampaignPerformance[]> {
    const now = new Date().toISOString()
    return Array.from(state.campaigns.values())
      .filter((c) => c.channel === channel)
      .map((c) => ({
        source: 'google-ads-mock',
        retrievedAt: now,
        period: `${range.from}..${range.to}`,
        providerCampaignId: c.providerCampaignId,
        spend: 310.2,
        impressions: 42000,
        clicks: 640,
        ctr: 0.0152,
        cpc: 0.48,
        cpm: 7.38,
        conversions: 22,
        conversionRate: 0.0344,
        cpa: 14.1,
        roas: 3.6,
        revenue: 1116.72,
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
      name: input.name ?? 'Mock Google Ads Campaign',
      channel: 'google_ads',
      status: 'PAUSED', // always created paused - see doc comment above
      budget: input.budget,
    }
    state.campaigns.set(campaign.providerCampaignId, campaign)
    return campaign
  },

  async updateCampaign(providerCampaignId, input): Promise<AdCampaignRecord> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Google Ads campaign with id "${providerCampaignId}".`)
    Object.assign(campaign, input)
    return campaign
  },

  async pauseCampaign(providerCampaignId): Promise<void> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Google Ads campaign with id "${providerCampaignId}".`)
    campaign.status = 'PAUSED'
  },

  async updateBudget(providerCampaignId, budget): Promise<void> {
    const campaign = state.campaigns.get(providerCampaignId)
    if (!campaign) throw new Error(`Mock: no Google Ads campaign with id "${providerCampaignId}".`)
    campaign.budget = budget
  },

  async updateBid(): Promise<void> {
    // No per-ad bid state in this mock, same simplification MetricoolMockProvider makes - accepted as a no-op.
  },
}
