/**
 * Amazon Advertising API (Sponsored Products, v3) Production Client
 *
 * Not live-verified - this environment has no Amazon Advertising API
 * access application, Login with Amazon (LWA) app, or test advertiser
 * account (see docs/EXTERNAL-APPROVALS.md and the Full Automation
 * Roadmap). Every request/response shape below follows Amazon's published
 * reference (advertising.amazon.com/API/docs/en-us/reference/) as
 * precisely as training data allows and is unit-tested against that exact
 * shape - "documented" is not "confirmed". Amazon Ads has no official
 * Node.js client library either, same situation as Google Ads.
 *
 * Scope: Sponsored Products only (the highest-volume Amazon ad type, and
 * the one BRD-PRD's own campaign-creation form already collects fields
 * for - `AmazonCampaignType`/`AmazonTargetingType`, src/lib/ads/types.ts).
 * Sponsored Brands/Display would be additional, near-identical adapters if
 * ever needed - not built here.
 *
 * Auth model, same shape as Google Ads' manager account: one agency-wide
 * Login with Amazon refresh token (`AMAZON_ADS_REFRESH_TOKEN`) can act on
 * any advertiser "profile" shared with that Amazon account - identified
 * per call by its numeric profile id, sent as the
 * `Amazon-Advertising-API-Scope` header. That profile id is what this
 * app's `IntegrationConnection.externalAccountId` stores per client - see
 * `connect.ts`.
 */

const OAUTH_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

/** Amazon Ads accounts live in one of three regional API endpoints - see AMAZON_ADS_REGION in .env.example. */
const REGION_BASE_URLS: Record<string, string> = {
  NA: 'https://advertising-api.amazon.com',
  EU: 'https://advertising-api-eu.amazon.com',
  FE: 'https://advertising-api-fe.amazon.com',
}

function apiBase(): string {
  const region = (process.env.AMAZON_ADS_REGION || 'NA').toUpperCase()
  const base = REGION_BASE_URLS[region]
  if (!base) throw new Error(`Unknown AMAZON_ADS_REGION "${region}" - expected NA, EU, or FE.`)
  return base
}

export interface AmazonCampaign {
  campaignId: string
  name: string
  state: 'enabled' | 'paused' | 'archived' | string
  campaignType: string
  targetingType?: string
  dailyBudget?: number
  startDate?: string
  endDate?: string
}

export interface AmazonAdGroup {
  adGroupId: string
  campaignId: string
  name: string
  state: string
  defaultBid?: number
}

export interface AmazonProductAd {
  adId: string
  campaignId: string
  adGroupId: string
  state: string
  sku?: string
  asin?: string
}

export interface AmazonCampaignMetrics {
  campaignId: string
  date?: string
  impressions: number
  clicks: number
  cost: number
  purchases: number
  sales: number
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Amazon Ads API ${name} is not configured.`)
  return value
}

function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

// In-memory access token cache (per process) - Amazon LWA access tokens are short-lived (~1 hour).
let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const clientId = requireEnv('AMAZON_ADS_CLIENT_ID')
  const clientSecret = requireEnv('AMAZON_ADS_CLIENT_SECRET')
  const refreshToken = requireEnv('AMAZON_ADS_REFRESH_TOKEN')

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) {
    throw new Error(`[Amazon LWA] Failed to refresh access token: ${json.error_description || json.error || res.status}`)
  }

  cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return cachedToken.accessToken
}

/** Test-only: forces the next getAccessToken() call to refresh instead of reusing a cached token. */
export function _resetAmazonAdsTokenCacheForTests(): void {
  cachedToken = null
}

async function amazonAdsFetch<T>(
  profileId: string,
  path: string,
  options: { method?: string; contentType?: string; body?: unknown } = {},
): Promise<T> {
  const clientId = requireEnv('AMAZON_ADS_CLIENT_ID')
  const accessToken = await getAccessToken()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Amazon-Advertising-API-ClientId': clientId,
    'Amazon-Advertising-API-Scope': profileId,
  }
  if (options.contentType) {
    headers['Content-Type'] = options.contentType
    headers.Accept = options.contentType
  }

  const res = await fetch(`${apiBase()}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = json?.details || json?.message || `Amazon Advertising API error (status ${res.status})`
    throw new Error(`[Amazon Ads API ${res.status}]: ${message}`)
  }
  return json as T
}

/** Raises the first per-item error out of a v3 batch mutate response (`{ success: [...], error: [...] }`) - Amazon's batch endpoints return 200 even when every item failed. */
function throwOnBatchErrors(resourceLabel: string, batch: { success?: unknown[]; error?: Array<{ errors?: Array<{ errorType?: string; errorValue?: string }> }> } | undefined): void {
  const firstError = batch?.error?.[0]
  if (firstError) {
    const detail = firstError.errors?.[0]
    throw new Error(`[Amazon Ads API] ${resourceLabel} operation failed: ${detail?.errorType || 'unknown error'} - ${detail?.errorValue || JSON.stringify(firstError)}`)
  }
}

export async function fetchAmazonCampaigns(profileId: string): Promise<AmazonCampaign[]> {
  const response = await amazonAdsFetch<{ campaigns: AmazonCampaign[] }>(profileId, '/sp/campaigns/list', {
    method: 'POST',
    contentType: 'application/vnd.spCampaign.v3+json',
    body: { stateFilter: { include: ['ENABLED', 'PAUSED'] }, maxResults: 100 },
  })
  return response.campaigns || []
}

export async function fetchAmazonAdGroups(profileId: string, campaignId: string): Promise<AmazonAdGroup[]> {
  const response = await amazonAdsFetch<{ adGroups: AmazonAdGroup[] }>(profileId, '/sp/adGroups/list', {
    method: 'POST',
    contentType: 'application/vnd.spAdGroup.v3+json',
    body: { campaignIdFilter: { include: [campaignId] }, maxResults: 100 },
  })
  return response.adGroups || []
}

export async function fetchAmazonProductAds(profileId: string, adGroupId: string): Promise<AmazonProductAd[]> {
  const response = await amazonAdsFetch<{ productAds: AmazonProductAd[] }>(profileId, '/sp/productAds/list', {
    method: 'POST',
    contentType: 'application/vnd.spProductAd.v3+json',
    body: { adGroupIdFilter: { include: [adGroupId] }, maxResults: 100 },
  })
  return response.productAds || []
}

/**
 * Creates a new Sponsored Products campaign, always `state: "paused"` (BRD
 * Section 21: creating is MEDIUM/automatic, launching is a separate
 * HIGH/approval-gated `update_campaign` call - same convention as Meta's
 * `createMetaCampaign` and Google's `createMetaCampaign`/
 * `createGoogleAdsCampaign`). Defaults `targetingType: "auto"` (Amazon
 * targets automatically from the advertised product's listing) since
 * nothing upstream collects manual keyword/product targets yet - matches
 * how Meta defaults to a generic objective and Google to manual CPC when
 * the minimal `{name, budget}` input doesn't specify more. Unlike Meta/
 * Google, this creates only the campaign resource, not an ad group -
 * matching the same scope those two adapters keep for `createCampaign`.
 */
export async function createAmazonCampaign(profileId: string, input: { name: string; budget?: number }): Promise<AmazonCampaign> {
  const response = await amazonAdsFetch<{ campaigns: { success?: Array<{ campaignId: string }>; error?: Array<{ errors?: Array<{ errorType?: string; errorValue?: string }> }> } }>(
    profileId,
    '/sp/campaigns',
    {
      method: 'POST',
      contentType: 'application/vnd.spCampaign.v3+json',
      body: {
        campaigns: [
          {
            name: input.name,
            campaignType: 'sponsoredProducts',
            targetingType: 'auto',
            state: 'paused',
            dailyBudget: input.budget ?? 10,
            startDate: todayYYYYMMDD(),
            bidding: { strategy: 'legacyForSales' },
          },
        ],
      },
    },
  )
  throwOnBatchErrors('createCampaign', response.campaigns)
  const campaignId = response.campaigns.success?.[0]?.campaignId
  if (!campaignId) throw new Error('Amazon Ads did not return a campaign id.')

  return { campaignId, name: input.name, state: 'paused', campaignType: 'sponsoredProducts', targetingType: 'auto', dailyBudget: input.budget ?? 10 }
}

/** Pauses or re-activates a campaign. Re-activating is only ever reached through the approval-gated `update_campaign` tool. */
export async function setAmazonCampaignState(profileId: string, campaignId: string, state: 'paused' | 'enabled'): Promise<void> {
  const response = await amazonAdsFetch<{ campaigns: { success?: unknown[]; error?: Array<{ errors?: Array<{ errorType?: string; errorValue?: string }> }> } }>(profileId, '/sp/campaigns', {
    method: 'PUT',
    contentType: 'application/vnd.spCampaign.v3+json',
    body: { campaigns: [{ campaignId, state }] },
  })
  throwOnBatchErrors('setCampaignState', response.campaigns)
}

export async function updateAmazonCampaignBudget(profileId: string, campaignId: string, dailyBudget: number): Promise<void> {
  const response = await amazonAdsFetch<{ campaigns: { success?: unknown[]; error?: Array<{ errors?: Array<{ errorType?: string; errorValue?: string }> }> } }>(profileId, '/sp/campaigns', {
    method: 'PUT',
    contentType: 'application/vnd.spCampaign.v3+json',
    body: { campaigns: [{ campaignId, dailyBudget }] },
  })
  throwOnBatchErrors('updateBudget', response.campaigns)
}

/** Amazon Ads sets bids on an ad group's `defaultBid` (or per-keyword), never on an individual product ad - see provider.ts's doc comment on `updateBid`. */
export async function updateAmazonAdGroupBid(profileId: string, adGroupId: string, defaultBid: number): Promise<void> {
  const response = await amazonAdsFetch<{ adGroups: { success?: unknown[]; error?: Array<{ errors?: Array<{ errorType?: string; errorValue?: string }> }> } }>(profileId, '/sp/adGroups', {
    method: 'PUT',
    contentType: 'application/vnd.spAdGroup.v3+json',
    body: { adGroups: [{ adGroupId, defaultBid }] },
  })
  throwOnBatchErrors('updateBid', response.adGroups)
}

/**
 * Amazon Ads has no synchronous "get today's stats" endpoint for
 * Sponsored Products - performance data is only available through the
 * asynchronous Reporting API (v3): request a report, poll until it's
 * generated, then download and decompress it. This requests the report
 * and polls with a bounded budget (10 attempts, 3s apart - ~30s total)
 * rather than blocking indefinitely; a report still `PENDING` after that
 * throws rather than returning partial/fabricated data (CLAUDE.md rule 5).
 * In production this ceiling may need to grow, or reporting may need to
 * move to the scheduled worker (Full Automation Roadmap §4 phase 9)
 * instead of running inline on a user-facing request.
 */
export async function fetchAmazonCampaignMetrics(profileId: string, options: { fromDate: string; toDate: string }): Promise<AmazonCampaignMetrics[]> {
  const requested = await amazonAdsFetch<{ reportId: string }>(profileId, '/reporting/reports', {
    method: 'POST',
    contentType: 'application/vnd.createasyncreportrequest.v3+json',
    body: {
      name: `TargetGum campaign report ${options.fromDate}..${options.toDate}`,
      startDate: options.fromDate,
      endDate: options.toDate,
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        groupBy: ['campaign'],
        columns: ['date', 'campaignId', 'impressions', 'clicks', 'cost', 'purchases7d', 'sales7d'],
        reportTypeId: 'spCampaigns',
        timeUnit: 'DAILY',
        format: 'GZIP_JSON',
      },
    },
  })

  const reportUrl = await pollAmazonReport(profileId, requested.reportId)
  return downloadAndParseAmazonReport(reportUrl)
}

async function pollAmazonReport(profileId: string, reportId: string, attempts = 10, intervalMs = 3000): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await amazonAdsFetch<{ status: string; url?: string }>(profileId, `/reporting/reports/${reportId}`, { method: 'GET' })
    if (status.status === 'COMPLETED' && status.url) return status.url
    if (status.status === 'FAILURE') throw new Error(`Amazon Ads report ${reportId} failed to generate.`)
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Amazon Ads report ${reportId} was still generating after ${(attempts * intervalMs) / 1000}s - try again shortly.`)
}

async function downloadAndParseAmazonReport(url: string): Promise<AmazonCampaignMetrics[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download Amazon Ads report (status ${res.status}).`)
  const compressed = Buffer.from(await res.arrayBuffer())
  const { gunzipSync } = await import('node:zlib')
  const decompressed = gunzipSync(compressed).toString('utf-8')
  const rows = JSON.parse(decompressed) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    campaignId: String(row.campaignId),
    date: row.date as string | undefined,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    cost: Number(row.cost ?? 0),
    purchases: Number(row.purchases7d ?? 0),
    sales: Number(row.sales7d ?? 0),
  }))
}

export { pollAmazonReport, downloadAndParseAmazonReport }
