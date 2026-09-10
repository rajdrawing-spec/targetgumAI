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
import { UnsupportedOperationError } from '../errors'
import { callMetricoolTool } from './mcp-client'

/**
 * The real Metricool adapter, calling Metricool's MCP server via
 * src/lib/integrations/metricool/mcp-client.ts. Method-by-method notes on
 * what's actually verified vs. best-effort are inline - see
 * docs/INTEGRATIONS.md and docs/DECISIONS.md for the full picture.
 *
 * SAFETY RULE: nothing in this adapter can trigger real-world publication.
 * `schedulePost`/`createPost` always send `draft: true` to Metricool - see
 * the note on `buildPostInfo` below. `publishPost` is unimplemented
 * (UnsupportedOperationError) rather than wired to anything that could
 * cause a real publish, since that would need to be its own HIGH-risk,
 * Approval-Engine-gated tool (Day 10), not something reachable today.
 */

interface RawBrand {
  id: number | string
  label?: string
  timezone?: string
  networksData?: Record<string, string>
}

interface RawScheduledPost {
  id?: string | number
  uuid?: string
  text?: string
  providers?: Array<{ network: string }>
  status?: string
  publicationDate?: { dateTime?: string }
  [key: string]: unknown
}

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Metricool returned an unexpected response shape (${context}): ${JSON.stringify(value)}`)
  }
  return value
}

async function findBrand(brandId: string): Promise<RawBrand> {
  const result = (await callMetricoolTool('getBrandSettings', {})) as { data?: RawBrand[] } | RawBrand[]
  const brands = Array.isArray(result) ? result : (result.data ?? [])
  const brand = brands.find((b) => String(b.id) === brandId)
  if (!brand) {
    throw new Error(`No Metricool brand found with id "${brandId}".`)
  }
  return brand
}

/**
 * `network*Data` suffix keys on getBrandSettings (facebookData, instagramData,
 * ...) each hold that network's connected external id/handle - verified
 * live during Day 1 architecture work (docs/DECISIONS.md). "Ads" keys
 * (facebookAdsData, googleAdsData) follow the same pattern but represent an
 * ads account, not a social network - excluded here.
 */
function extractConnectedNetworks(brand: RawBrand): ConnectedNetwork[] {
  const networksData = brand.networksData ?? {}
  return Object.entries(networksData)
    .filter(([key]) => !key.toLowerCase().includes('ads'))
    .map(([key, externalId]) => ({
      network: key.replace(/Data$/, '').toLowerCase(),
      externalId,
    }))
}

/**
 * Builds the `info` payload for createScheduledPost/updateScheduledPost.
 * Always `draft: true` - see the safety note in this file's header comment.
 * Per-network `<network>Data` objects are sent empty ("as empty if you
 * don't have more information" - verified tool description); richer
 * per-network options (Instagram Reel type, YouTube privacy, etc.) aren't
 * exposed through TargetGum's generic SocialPostInput yet.
 */
function buildPostInfo(input: SocialPostInput): Record<string, unknown> {
  const networkData = Object.fromEntries(input.networks.map((network) => [`${network}Data`, {}]))
  return {
    draft: true,
    autoPublish: false,
    text: input.text,
    media: input.mediaUrls ?? [],
    providers: input.networks.map((network) => ({ network })),
    publicationDate: {
      // Metricool wants a bare "YYYY-MM-DDTHH:mm:ss" plus a separate IANA
      // timezone - stripping any offset/Z suffix from the ISO input.
      dateTime: input.scheduledAt.replace(/(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, ''),
      timezone: 'UTC', // TODO(Day 8): use the brand's real timezone from getBrandSettings once Client Brain wiring resolves it per-client
    },
    ...networkData,
  }
}

function toSocialPostRecord(raw: RawScheduledPost): SocialPostRecord {
  const providerPostId = raw.id != null ? String(raw.id) : raw.uuid
  if (!providerPostId) {
    throw new Error(`Metricool returned a scheduled post with no id/uuid: ${JSON.stringify(raw)}`)
  }
  return {
    providerPostId,
    networks: (raw.providers ?? []).map((p) => p.network),
    text: raw.text ?? '',
    status: raw.status ?? 'scheduled',
    scheduledAt: raw.publicationDate?.dateTime,
  }
}

export const MetricoolProvider: SocialProvider & Partial<AdsProvider> = {
  async getConnectedNetworks(brandId) {
    const brand = await findBrand(brandId)
    return extractConnectedNetworks(brand)
  },

  async createPost(input) {
    const info = buildPostInfo(input)
    const result = (await callMetricoolTool('createScheduledPost', {
      blogId: input.brandId,
      date: input.scheduledAt,
      info: JSON.stringify(info),
    })) as RawScheduledPost
    return toSocialPostRecord(result)
  },

  async schedulePost(input) {
    // Same call as createPost - Metricool has one "create a scheduled post"
    // operation; TargetGum's createPost/schedulePost distinction (BRD
    // Section 16) is enforced at the content_calendar status level, not by
    // Metricool. Both remain `draft: true` per the safety note above.
    return MetricoolProvider.createPost(input)
  },

  async publishPost() {
    throw new UnsupportedOperationError(
      'metricool',
      'publishPost',
      'no verified Metricool MCP tool immediately publishes an existing scheduled post - would need its own HIGH-risk, Approval-Engine-gated implementation (Day 10)',
    )
  },

  async getPosts(brandId, range) {
    const brand = await findBrand(brandId)
    const result = (await callMetricoolTool('getScheduledPosts', {
      brandId,
      fromDate: range.from,
      toDate: range.to,
      timezone: brand.timezone ?? 'UTC',
    })) as { data?: RawScheduledPost[] } | RawScheduledPost[]
    const posts = Array.isArray(result) ? result : (result.data ?? [])
    return posts.map(toSocialPostRecord)
    // NOTE: getScheduledPosts only returns posts not yet published - there
    // is no verified tool for published-post history. See docs/INTEGRATIONS.md.
  },

  async getAnalytics(brandId, network, range) {
    const availableMetrics = (await callMetricoolTool('getAnalyticsAvailableMetrics', {
      network,
      connector: 'evolution',
    })) as Array<{ fieldId: string; metricName: string }>

    if (availableMetrics.length === 0) {
      return []
    }

    const data = (await callMetricoolTool('getAnalyticsDataByMetrics', {
      brandId,
      from: range.from,
      to: range.to,
      metrics: availableMetrics.map((m) => m.fieldId),
    })) as unknown

    // Best-effort field mapping: match each returned value back to its
    // metric name and place it into the normalized shape where the name
    // matches a known field; always preserved verbatim in `raw` regardless.
    // Refine this once Day 9's Analytics Agent is a real consumer and the
    // actual response shape for social (non-ads) evolution data is
    // exercised end-to-end - it wasn't verified beyond the googleAds
    // example checked during Day 1.
    const metricByFieldId = new Map(availableMetrics.map((m) => [m.fieldId, m.metricName]))
    const now = new Date().toISOString()
    const value: SocialMetricValue = { source: 'metricool', retrievedAt: now, period: `${range.from}..${range.to}`, raw: data }

    if (data && typeof data === 'object') {
      for (const [fieldId, fieldValue] of Object.entries(data as Record<string, unknown>)) {
        const name = metricByFieldId.get(fieldId)?.toLowerCase()
        if (!name || typeof fieldValue !== 'number') continue
        if (name.includes('reach')) value.reach = fieldValue
        else if (name.includes('impression')) value.impressions = fieldValue
        else if (name.includes('engagement')) value.engagement = fieldValue
        else if (name.includes('like')) value.likes = fieldValue
        else if (name.includes('comment')) value.comments = fieldValue
        else if (name.includes('share')) value.shares = fieldValue
        else if (name.includes('save')) value.saves = fieldValue
        else if (name.includes('click')) value.clicks = fieldValue
        else if (name.includes('follower')) value.followers = fieldValue
        else if (name.includes('video') && name.includes('view')) value.videoViews = fieldValue
      }
    }

    return [value]
  },

  // --- AdsProvider: read-only, per docs/INTEGRATIONS.md verified findings ---

  async getCampaigns(brandId, channel) {
    const availableMetrics = (await callMetricoolTool('getAnalyticsAvailableMetrics', {
      network: channel,
      connector: 'campaigns',
    })) as Array<{ fieldId: string; metricName: string }>
    if (availableMetrics.length === 0) return []

    const nameField = availableMetrics.find((m) => m.metricName === 'name')
    if (!nameField) return []

    // Campaign *listing* (as opposed to performance) isn't independently
    // verified beyond the field schema - this reuses getAnalyticsDataByMetrics
    // with an unbounded-ish recent window, best-effort. Refine once a real
    // connected ads account is available to test against (docs/EXTERNAL-APPROVALS.md).
    const to = new Date().toISOString()
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const data = (await callMetricoolTool('getAnalyticsDataByMetrics', {
      brandId,
      from,
      to,
      metrics: availableMetrics.map((m) => m.fieldId),
    })) as unknown

    return Array.isArray(data)
      ? (data as Array<Record<string, unknown>>).map((row) => ({
          providerCampaignId: assertString(row[nameField.fieldId] ?? row.name, 'campaign name'),
          name: assertString(row[nameField.fieldId] ?? row.name, 'campaign name'),
          channel,
        }))
      : []
  },

  async getCampaignPerformance(brandId, channel, range) {
    const availableMetrics = (await callMetricoolTool('getAnalyticsAvailableMetrics', {
      network: channel,
      connector: 'campaigns',
    })) as Array<{ fieldId: string; metricName: string }>
    if (availableMetrics.length === 0) return []

    const data = (await callMetricoolTool('getAnalyticsDataByMetrics', {
      brandId,
      from: range.from,
      to: range.to,
      metrics: availableMetrics.map((m) => m.fieldId),
    })) as unknown

    const metricByFieldId = new Map(availableMetrics.map((m) => [m.fieldId, m.metricName]))
    const now = new Date().toISOString()
    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [data as Record<string, unknown>]

    return rows.map((row) => {
      const perf: AdCampaignPerformance = {
        source: 'metricool',
        retrievedAt: now,
        period: `${range.from}..${range.to}`,
        providerCampaignId: assertString(row.name ?? row.providerCampaignId ?? 'unknown', 'campaign id'),
        raw: row,
      }
      for (const [fieldId, fieldValue] of Object.entries(row)) {
        const name = metricByFieldId.get(fieldId)?.toLowerCase()
        if (!name || typeof fieldValue !== 'number') continue
        if (name === 'spent') perf.spend = fieldValue
        else if (name === 'impressions') perf.impressions = fieldValue
        else if (name === 'clicks') perf.clicks = fieldValue
        else if (name === 'conversions') perf.conversions = fieldValue
        else if (name.includes('conversions value')) perf.revenue = fieldValue
      }
      return perf
    })
  },

  async getAdGroups(): Promise<AdGroupRecord[]> {
    throw new UnsupportedOperationError('metricool', 'getAdGroups', 'no verified Metricool MCP tool for ad groups')
  },
  async getAds(): Promise<AdRecord[]> {
    throw new UnsupportedOperationError('metricool', 'getAds', 'no verified Metricool MCP tool for individual ads')
  },
  async createCampaign(): Promise<AdCampaignRecord> {
    throw new UnsupportedOperationError('metricool', 'createCampaign', 'Metricool MCP has no ads write endpoints - see docs/INTEGRATIONS.md')
  },
  async updateCampaign(): Promise<AdCampaignRecord> {
    throw new UnsupportedOperationError('metricool', 'updateCampaign', 'Metricool MCP has no ads write endpoints - see docs/INTEGRATIONS.md')
  },
  async pauseCampaign(): Promise<void> {
    throw new UnsupportedOperationError('metricool', 'pauseCampaign', 'Metricool MCP has no ads write endpoints - see docs/INTEGRATIONS.md')
  },
  async updateBudget(): Promise<void> {
    throw new UnsupportedOperationError('metricool', 'updateBudget', 'Metricool MCP has no ads write endpoints - see docs/INTEGRATIONS.md')
  },
  async updateBid(): Promise<void> {
    throw new UnsupportedOperationError('metricool', 'updateBid', 'Metricool MCP has no ads write endpoints - see docs/INTEGRATIONS.md')
  },
}
