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

// ---------------------------------------------------------------------------
// Creative (Canva)
// ---------------------------------------------------------------------------

export interface CreativeDesignInput {
  title: string
  concept: string
  copy?: string
  platform: string
}

/** `designUrl` is the "continue editing through Canva" link BRD Section 17 requires - never build a Canva editor replacement, always hand back a real link. */
export interface CreativeDesignRecord {
  providerDesignId: string
  designUrl: string
  exportUrl?: string
  status: string
  thumbnailUrl?: string
}

export interface CreativeSearchResult {
  providerAssetId: string
  title: string
  thumbnailUrl?: string
}

/**
 * BRD Section 17's operation list (create/edit/search designs, search
 * assets, export). "Access brand assets" is folded into `searchAssets`
 * rather than a separate method - both are read-only Canva asset lookups,
 * differing only in what's being searched for.
 */
export interface CreativeProvider {
  createDesign(brandId: string, input: CreativeDesignInput): Promise<CreativeDesignRecord>
  editDesign(providerDesignId: string, input: Partial<CreativeDesignInput>): Promise<CreativeDesignRecord>
  searchDesigns(brandId: string, query: string): Promise<CreativeSearchResult[]>
  searchAssets(brandId: string, query: string): Promise<CreativeSearchResult[]>
  exportDesign(providerDesignId: string): Promise<CreativeDesignRecord>
}

// ---------------------------------------------------------------------------
// Website analytics (GA4)
// ---------------------------------------------------------------------------

export interface AnalyticsReportRequest {
  propertyId: string
  dimensions: string[] // e.g. "date", "sessionDefaultChannelGroup", "landingPage"
  metrics: string[] // e.g. "sessions", "conversions", "totalRevenue"
  range: { from: string; to: string }
}

export interface AnalyticsReportRow extends Provenance {
  dimensions: Record<string, string>
  metrics: Record<string, number>
  raw: unknown
}

/** BRD-PRD Section 35 - traffic, users, sessions, engagement, conversions, revenue, landing pages, traffic sources, campaign performance - all reachable via dimension/metric choice on one runReport call. */
export interface AnalyticsProvider {
  getReport(request: AnalyticsReportRequest): Promise<AnalyticsReportRow[]>
}

// ---------------------------------------------------------------------------
// Search analytics (Google Search Console)
// ---------------------------------------------------------------------------

export interface SeoQueryRequest {
  siteUrl: string
  dimensions: Array<'query' | 'page' | 'date' | 'country' | 'device'>
  range: { from: string; to: string }
  rowLimit?: number
}

export interface SeoQueryRow extends Provenance {
  keys: Record<string, string>
  clicks: number
  impressions: number
  ctr: number
  position: number
  raw: unknown
}

/** BRD-PRD Section 36 - queries, clicks, impressions, CTR, average position, pages. */
export interface SEOProvider {
  getSearchPerformance(request: SeoQueryRequest): Promise<SeoQueryRow[]>
}
