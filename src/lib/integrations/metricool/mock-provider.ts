import { randomUUID } from 'crypto'
import type {
  AdCampaignPerformance,
  AdCampaignRecord,
  AdGroupRecord,
  AdRecord,
  AdsProvider,
  ConnectedNetwork,
  SocialMetricValue,
  SocialPostInput,
  SocialPostRecord,
  SocialProvider,
} from '../providers'

/**
 * Full mock implementation of SocialProvider + AdsProvider (BRD-PRD Section
 * 92) - deterministic, in-memory, no network. Lets the rest of the app
 * (Tool Registry entries, and eventually the Analytics/Content agents) be
 * built and tested end-to-end without a live Metricool MCP connection.
 * Unlike the real adapter, this implements every AdsProvider write method
 * too (as accepted no-ops returning plausible data) so workflow code that
 * exercises the full interface has something to run against - the real
 * adapter is what actually can't do writes, not the interface itself.
 */
class MockState {
  posts = new Map<string, SocialPostRecord>()
  campaigns: AdCampaignRecord[] = [
    { providerCampaignId: 'mock-campaign-1', name: 'Mock Search Campaign', channel: 'googleAds', status: 'ENABLED', budget: 50 },
    { providerCampaignId: 'mock-campaign-2', name: 'Mock Retargeting Campaign', channel: 'metaAds', status: 'ENABLED', budget: 30 },
  ]
}

const state = new MockState()

export const MetricoolMockProvider: SocialProvider & AdsProvider = {
  async getConnectedNetworks(): Promise<ConnectedNetwork[]> {
    return [
      { network: 'instagram', externalId: 'mock_instagram_handle' },
      { network: 'facebook', externalId: 'mock_facebook_page' },
    ]
  },

  async createPost(input: SocialPostInput): Promise<SocialPostRecord> {
    const record: SocialPostRecord = {
      providerPostId: randomUUID(),
      networks: input.networks,
      text: input.text,
      status: 'draft',
      scheduledAt: input.scheduledAt,
    }
    state.posts.set(record.providerPostId, record)
    return record
  },

  async schedulePost(input: SocialPostInput): Promise<SocialPostRecord> {
    const record = await this.createPost(input)
    record.status = 'scheduled'
    return record
  },

  async publishPost(providerPostId: string): Promise<SocialPostRecord> {
    const record = state.posts.get(providerPostId)
    if (!record) throw new Error(`Mock: no post with id "${providerPostId}".`)
    record.status = 'published'
    record.publishedAt = new Date().toISOString()
    return record
  },

  async getPosts(): Promise<SocialPostRecord[]> {
    return Array.from(state.posts.values())
  },

  async getAnalytics(_brandId, _network, range): Promise<SocialMetricValue[]> {
    return [
      {
        source: 'metricool-mock',
        retrievedAt: new Date().toISOString(),
        period: `${range.from}..${range.to}`,
        reach: 4200,
        impressions: 8100,
        engagement: 310,
        likes: 250,
        comments: 40,
        shares: 20,
        clicks: 95,
        followers: 1850,
        raw: { mock: true },
      },
    ]
  },

  async getCampaigns(_brandId, channel): Promise<AdCampaignRecord[]> {
    return state.campaigns.filter((c) => c.channel === channel)
  },

  async getCampaignPerformance(_brandId, channel, range): Promise<AdCampaignPerformance[]> {
    const now = new Date().toISOString()
    return state.campaigns
      .filter((c) => c.channel === channel)
      .map((c) => ({
        source: 'metricool-mock',
        retrievedAt: now,
        period: `${range.from}..${range.to}`,
        providerCampaignId: c.providerCampaignId,
        spend: 420.5,
        impressions: 51000,
        clicks: 890,
        ctr: 0.0175,
        cpc: 0.47,
        cpm: 8.25,
        conversions: 34,
        conversionRate: 0.038,
        cpa: 12.37,
        roas: 3.1,
        revenue: 1303.55,
        raw: { mock: true },
      }))
  },

  async getAdGroups(_brandId, providerCampaignId): Promise<AdGroupRecord[]> {
    return [{ providerAdGroupId: `${providerCampaignId}-adgroup-1`, providerCampaignId, name: 'Mock Ad Group' }]
  },

  async getAds(_brandId, providerAdGroupId): Promise<AdRecord[]> {
    return [{ providerAdId: `${providerAdGroupId}-ad-1`, providerAdGroupId, name: 'Mock Ad' }]
  },

  async createCampaign(_brandId, input): Promise<AdCampaignRecord> {
    const campaign: AdCampaignRecord = {
      providerCampaignId: randomUUID(),
      name: input.name ?? 'Mock Campaign',
      channel: input.channel ?? 'googleAds',
      status: 'ENABLED',
      budget: input.budget,
    }
    state.campaigns.push(campaign)
    return campaign
  },

  async updateCampaign(providerCampaignId, input): Promise<AdCampaignRecord> {
    const campaign = state.campaigns.find((c) => c.providerCampaignId === providerCampaignId)
    if (!campaign) throw new Error(`Mock: no campaign with id "${providerCampaignId}".`)
    Object.assign(campaign, input)
    return campaign
  },

  async pauseCampaign(providerCampaignId): Promise<void> {
    const campaign = state.campaigns.find((c) => c.providerCampaignId === providerCampaignId)
    if (campaign) campaign.status = 'PAUSED'
  },

  async updateBudget(providerCampaignId, budget): Promise<void> {
    const campaign = state.campaigns.find((c) => c.providerCampaignId === providerCampaignId)
    if (campaign) campaign.budget = budget
  },

  async updateBid(): Promise<void> {
    // No per-ad bid state in this mock - accepted as a no-op.
  },
}
