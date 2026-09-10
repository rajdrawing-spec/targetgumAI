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

/**
 * `getAnalyticsDataByMetrics`'s real response shape - verified live against
 * a real brand (TargetGum, id 6818704) during Day 15 pilot-readiness work,
 * NOT the shape originally assumed from documentation alone (a `fieldId`-
 * keyed object). It is `{ rows: [[...values in the same order as the
 * requested `metrics` array..., "YYYYMMDD"]] }` - one row per date in the
 * range, numeric values as strings, `null` for a day with no data, and a
 * trailing `YYYYMMDD` date string appended after the requested metrics.
 * Confirmed for the `evolution` connector; the `campaigns` connector
 * (`getCampaigns`/`getCampaignPerformance` below) reuses the same
 * underlying tool and is assumed to follow the same wire shape, but that
 * specific connector was not independently live-verified (no connected ads
 * account was available to test against - docs/EXTERNAL-APPROVALS.md).
 */
interface MetricsRowsResponse {
  rows?: unknown[][]
}

interface ParsedMetricRow {
  /** fieldId -> the raw value Metricool returned for that field on this row (still a string for numbers - not every field is numeric, e.g. a campaign's `name`, so this stays unconverted; use `numericField` below to read a specific field as a number). */
  values: Map<string, unknown>
  /** The row's YYYYMMDD date, if the response included the expected trailing date element. */
  date?: string
}

function parseMetricRows(data: unknown, fieldIds: string[]): ParsedMetricRow[] {
  const rows = data && typeof data === 'object' && Array.isArray((data as MetricsRowsResponse).rows)
    ? (data as MetricsRowsResponse).rows!
    : []

  return rows.map((row) => {
    const values = new Map<string, unknown>()
    fieldIds.forEach((fieldId, i) => values.set(fieldId, row[i] ?? null))
    const trailing = row[fieldIds.length]
    const date = typeof trailing === 'string' && /^\d{8}$/.test(trailing) ? trailing : undefined
    return { values, date }
  })
}

/** Reads one field of a parsed row as a number, or undefined if it's null/missing/non-numeric (e.g. a name field). */
function numericField(row: ParsedMetricRow, fieldId: string): number | undefined {
  const raw = row.values.get(fieldId)
  if (raw == null) return undefined
  const num = Number(raw)
  return Number.isFinite(num) ? num : undefined
}

/** Reads one field of a parsed row as a string, or undefined if it's null/missing. */
function stringField(row: ParsedMetricRow, fieldId: string): string | undefined {
  const raw = row.values.get(fieldId)
  return raw == null ? undefined : String(raw)
}

/** "20260831" -> "2026-08-31". Returns the input unchanged if it isn't in that shape. */
function formatMetricoolDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
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

    const fieldIds = availableMetrics.map((m) => m.fieldId)
    const data = (await callMetricoolTool('getAnalyticsDataByMetrics', {
      brandId,
      from: range.from,
      to: range.to,
      metrics: fieldIds,
    })) as unknown

    // One row per date in the range (verified live shape - see
    // parseMetricRows above). Each becomes its own SocialMetricValue rather
    // than collapsing the whole range into one object, since the data
    // genuinely is a time series, not a single aggregate.
    const metricByFieldId = new Map(availableMetrics.map((m) => [m.fieldId, m.metricName]))
    const now = new Date().toISOString()
    const rows = parseMetricRows(data, fieldIds)

    return rows.map((row) => {
      const value: SocialMetricValue = {
        source: 'metricool',
        retrievedAt: now,
        period: row.date ? formatMetricoolDate(row.date) : `${range.from}..${range.to}`,
        raw: data,
      }
      for (const fieldId of row.values.keys()) {
        const fieldValue = numericField(row, fieldId)
        if (fieldValue == null) continue
        const name = metricByFieldId.get(fieldId)?.toLowerCase()
        if (!name) continue
        if (name.includes('reach')) value.reach = fieldValue
        else if (name.includes('impression')) value.impressions = fieldValue
        else if (name.includes('engagement') || name.includes('interaction')) value.engagement = fieldValue
        else if (name.includes('like')) value.likes = fieldValue
        else if (name.includes('comment')) value.comments = fieldValue
        else if (name.includes('share')) value.shares = fieldValue
        else if (name.includes('save')) value.saves = fieldValue
        else if (name.includes('click')) value.clicks = fieldValue
        else if (name.includes('follower')) value.followers = fieldValue
        else if (name.includes('video') && name.includes('view')) value.videoViews = fieldValue
      }
      return value
    })
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
    // with an unbounded-ish recent window, best-effort, and assumes the
    // same `{rows: [[...]]}` shape verified for the `evolution` connector
    // (see parseMetricRows above) - not independently confirmed for
    // `campaigns`. Refine once a real connected ads account is available to
    // test against (docs/EXTERNAL-APPROVALS.md).
    const to = new Date().toISOString()
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const fieldIds = availableMetrics.map((m) => m.fieldId)
    const data = (await callMetricoolTool('getAnalyticsDataByMetrics', {
      brandId,
      from,
      to,
      metrics: fieldIds,
    })) as unknown

    return parseMetricRows(data, fieldIds)
      .map((row) => stringField(row, nameField.fieldId))
      .filter((name): name is string => name != null && name !== '')
      .map((name) => ({ providerCampaignId: name, name, channel }))
  },

  async getCampaignPerformance(brandId, channel, range) {
    const availableMetrics = (await callMetricoolTool('getAnalyticsAvailableMetrics', {
      network: channel,
      connector: 'campaigns',
    })) as Array<{ fieldId: string; metricName: string }>
    if (availableMetrics.length === 0) return []

    const nameField = availableMetrics.find((m) => m.metricName === 'name')
    const fieldIds = availableMetrics.map((m) => m.fieldId)
    const data = (await callMetricoolTool('getAnalyticsDataByMetrics', {
      brandId,
      from: range.from,
      to: range.to,
      metrics: fieldIds,
    })) as unknown

    const metricByFieldId = new Map(availableMetrics.map((m) => [m.fieldId, m.metricName]))
    const now = new Date().toISOString()
    const rows = parseMetricRows(data, fieldIds)

    return rows.map((row) => {
      const providerCampaignId = (nameField && stringField(row, nameField.fieldId)) || 'unknown'
      const perf: AdCampaignPerformance = {
        source: 'metricool',
        retrievedAt: now,
        period: row.date ? formatMetricoolDate(row.date) : `${range.from}..${range.to}`,
        providerCampaignId,
        raw: Object.fromEntries(row.values),
      }
      for (const fieldId of row.values.keys()) {
        const fieldValue = numericField(row, fieldId)
        if (fieldValue == null) continue
        const name = metricByFieldId.get(fieldId)?.toLowerCase()
        if (!name) continue
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
