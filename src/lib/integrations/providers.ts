/**
 * Provider Abstraction (BRD-PRD Section 16, 109). Agent/tool code depends
 * only on these interfaces - never on a specific vendor. Metricool is the
 * first implementation (src/lib/integrations/metricool/); native Meta/
 * Google/Amazon adapters can be added later behind the same interfaces
 * without touching anything that calls them.
 *
 * Every metric-bearing type carries provenance (source/retrievedAt/period)
 * per docs/DATA-MODEL.md - never a bare number.
 */

export interface Provenance {
  source: string
  retrievedAt: string // ISO timestamp
  period: string
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export interface ConnectedNetwork {
  network: string // e.g. "instagram", "facebook", "linkedin"
  externalId: string
  label?: string
}

export interface SocialPostInput {
  brandId: string
  networks: string[]
  text: string
  mediaUrls?: string[]
  scheduledAt: string // ISO timestamp
}

export interface SocialPostRecord {
  providerPostId: string
  networks: string[]
  text: string
  status: string // provider's own status string, not TargetGum's ContentStatus enum
  scheduledAt?: string
  publishedAt?: string
}

/** Normalized per BRD Section 38 - reach, impressions, engagement, likes, comments, shares, saves, clicks, followers, video_views, watch_time. */
export interface SocialMetricValue extends Provenance {
  reach?: number
  impressions?: number
  engagement?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  clicks?: number
  followers?: number
  videoViews?: number
  watchTimeSeconds?: number
  raw: unknown
}

export interface SocialProvider {
  getConnectedNetworks(brandId: string): Promise<ConnectedNetwork[]>
  createPost(input: SocialPostInput): Promise<SocialPostRecord>
  schedulePost(input: SocialPostInput): Promise<SocialPostRecord>
  publishPost(providerPostId: string): Promise<SocialPostRecord>
  getPosts(brandId: string, range: { from: string; to: string }): Promise<SocialPostRecord[]>
  getAnalytics(
    brandId: string,
    network: string,
    range: { from: string; to: string },
  ): Promise<SocialMetricValue[]>
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

export interface AdCampaignRecord {
  providerCampaignId: string
  name: string
  channel: string // "google_ads" | "meta_ads" | "tiktok_ads" | ...
  status?: string
  budget?: number
  startDate?: string
  endDate?: string
}

/** Normalized per BRD Section 37 - spend, impressions, clicks, CTR, CPC, CPM, conversions, conversion_rate, CPA, ROAS, revenue, frequency, reach. */
export interface AdCampaignPerformance extends Provenance {
  providerCampaignId: string
  spend?: number
  impressions?: number
  clicks?: number
  ctr?: number
  cpc?: number
  cpm?: number
  conversions?: number
  conversionRate?: number
  cpa?: number
  roas?: number
  revenue?: number
  frequency?: number
  reach?: number
  raw: unknown
}

export interface AdGroupRecord {
  providerAdGroupId: string
  providerCampaignId: string
  name: string
}

export interface AdRecord {
  providerAdId: string
  providerAdGroupId: string
  name: string
}

/**
 * Every write method here is optional in practice for a given adapter - an
 * implementation that can't fulfill one (e.g. Metricool has no write
 * endpoints for ads at all - see docs/INTEGRATIONS.md) throws
 * UnsupportedOperationError rather than silently no-op'ing. BRD Section 15:
 * "verify every exact write operation required by TargetGum before
 * depending on it for production automation."
 */
export interface AdsProvider {
  getCampaigns(brandId: string, channel: string): Promise<AdCampaignRecord[]>
  getCampaignPerformance(
    brandId: string,
    channel: string,
    range: { from: string; to: string },
  ): Promise<AdCampaignPerformance[]>
  getAdGroups(brandId: string, providerCampaignId: string): Promise<AdGroupRecord[]>
  getAds(brandId: string, providerAdGroupId: string): Promise<AdRecord[]>
  createCampaign(brandId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord>
  updateCampaign(providerCampaignId: string, input: Partial<AdCampaignRecord>): Promise<AdCampaignRecord>
  pauseCampaign(providerCampaignId: string): Promise<void>
  updateBudget(providerCampaignId: string, budget: number): Promise<void>
  updateBid(providerAdId: string, bid: number): Promise<void>
}
