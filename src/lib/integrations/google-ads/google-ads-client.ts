/**
 * Google Ads API (v18, REST + GAQL) Production Client
 *
 * There is no official Node.js client library for the Google Ads API
 * (Google's own client-library list covers Java/.NET/PHP/Python/Perl/Ruby,
 * not Node - developers.google.com/google-ads/api/docs/client-libs), so
 * this talks to the documented REST interface directly, the same choice
 * already made for Meta (`meta-ads/meta-client.ts`).
 *
 * IMPORTANT - not live-verified: this environment has no
 * `GOOGLE_ADS_DEVELOPER_TOKEN`/OAuth client/test account (see
 * docs/EXTERNAL-APPROVALS.md), so nothing here has ever been exercised
 * against real Google Ads infrastructure. Every request/response shape
 * below follows Google's published REST reference
 * (developers.google.com/google-ads/api/rest/docs) as precisely as
 * training data allows, and each call site's tests assert this code sends
 * exactly the request it's documented to send - but "documented" is not
 * "confirmed". The two spots most likely to need a one-line fix against a
 * real account are flagged inline: the `updateMask` casing convention
 * (Google Ads' own REST examples use snake_case field-mask paths, unlike
 * the camelCase resource JSON itself) and whether a fresh SEARCH campaign
 * needs an explicit `networkSettings` block to pass validation.
 *
 * Auth model: Google Ads authenticates once per *manager* (MCC) account,
 * not once per client - a single OAuth refresh token (this agency's) plus
 * `login-customer-id` (the manager account) can act on any client account
 * linked under that manager, identified per call by `customerId`. That's
 * why, unlike Meta's per-connection encrypted token, there's nothing to
 * store per `IntegrationConnection` here beyond the client's Google Ads
 * customer id (`externalAccountId`) - the credentials are agency-wide env
 * vars, same shape `tools.ts` already assumed before this file existed.
 */

const API_VERSION = 'v18'
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface GoogleAdsCampaign {
  id: string
  name: string
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | string
  advertisingChannelType?: string
  budgetResourceName?: string
  budgetMicros?: number
  startDate?: string
  endDate?: string
}

export interface GoogleAdsCampaignMetrics {
  campaignId: string
  date?: string
  impressions: number
  clicks: number
  costMicros: number
  ctr: number
  averageCpcMicros: number
  conversions: number
  conversionsValue: number
}

export interface GoogleAdsAdGroup {
  id: string
  name: string
  campaignId: string
}

export interface GoogleAdsAd {
  id: string
  name: string
  adGroupId: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Google Ads API ${name} is not configured.`)
  return value
}

/** Google Ads customer/manager ids are digits-only in every API call, even though the UI displays them as "123-456-7890". */
function normalizeCustomerId(rawId: string): string {
  return rawId.replace(/[^0-9]/g, '')
}

function toMicros(dollars: number): number {
  return Math.round(dollars * 1_000_000)
}

function fromMicros(micros: number | string | undefined): number {
  if (micros === undefined) return 0
  return Number(micros) / 1_000_000
}

// In-memory access token cache (per process) - Google Ads access tokens are
// short-lived (~1 hour); refreshed lazily rather than on every call.
let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const clientId = requireEnv('GOOGLE_ADS_CLIENT_ID')
  const clientSecret = requireEnv('GOOGLE_ADS_CLIENT_SECRET')
  const refreshToken = requireEnv('GOOGLE_ADS_REFRESH_TOKEN')

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
    throw new Error(`[Google OAuth] Failed to refresh access token: ${json.error_description || json.error || res.status}`)
  }

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  }
  return cachedToken.accessToken
}

/** Test-only: forces the next getAccessToken() call to refresh instead of reusing a cached token. */
export function _resetGoogleAdsTokenCacheForTests(): void {
  cachedToken = null
}

async function googleAdsFetch<T>(customerId: string, endpoint: string, body: unknown): Promise<T> {
  const developerToken = requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN')
  const accessToken = await getAccessToken()
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }
  if (loginCustomerId) headers['login-customer-id'] = normalizeCustomerId(loginCustomerId)

  const res = await fetch(`${API_BASE}/customers/${normalizeCustomerId(customerId)}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = await res.json()

  if (!res.ok) {
    // Google Ads error responses are gRPC-status-shaped: { error: { code, message, details: [{ errors: [{ errorCode, message }] }] } }
    const detail = json?.error?.details?.[0]?.errors?.[0]?.message
    const message = detail || json?.error?.message || `Google Ads API error (status ${res.status})`
    throw new Error(`[Google Ads API ${res.status}]: ${message}`)
  }
  return json as T
}

/** Runs one GAQL query against a customer account. https://developers.google.com/google-ads/api/rest/docs/reference/search-fields */
async function searchGoogleAds(customerId: string, query: string): Promise<Array<Record<string, any>>> {
  const response = await googleAdsFetch<{ results?: Array<Record<string, any>> }>(customerId, 'googleAds:search', { query })
  return response.results || []
}

export async function fetchGoogleAdsCampaigns(customerId: string): Promise<GoogleAdsCampaign[]> {
  const rows = await searchGoogleAds(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            campaign.campaign_budget, campaign_budget.amount_micros,
            campaign.start_date, campaign.end_date
     FROM campaign
     WHERE campaign.status != 'REMOVED'
     ORDER BY campaign.id`,
  )
  return rows.map((row) => ({
    id: String(row.campaign.id),
    name: row.campaign.name,
    status: row.campaign.status,
    advertisingChannelType: row.campaign.advertisingChannelType,
    budgetResourceName: row.campaign.campaignBudget,
    budgetMicros: row.campaignBudget?.amountMicros !== undefined ? Number(row.campaignBudget.amountMicros) : undefined,
    startDate: row.campaign.startDate,
    endDate: row.campaign.endDate,
  }))
}

export async function fetchGoogleAdsCampaignMetrics(
  customerId: string,
  options: { fromDate: string; toDate: string },
): Promise<GoogleAdsCampaignMetrics[]> {
  const rows = await searchGoogleAds(
    customerId,
    `SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks,
            metrics.cost_micros, metrics.ctr, metrics.average_cpc,
            metrics.conversions, metrics.conversions_value
     FROM campaign
     WHERE segments.date BETWEEN '${options.fromDate}' AND '${options.toDate}'
     ORDER BY campaign.id, segments.date`,
  )
  return rows.map((row) => ({
    campaignId: String(row.campaign.id),
    date: row.segments?.date,
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    costMicros: Number(row.metrics?.costMicros ?? 0),
    ctr: Number(row.metrics?.ctr ?? 0),
    averageCpcMicros: Number(row.metrics?.averageCpc ?? 0),
    conversions: Number(row.metrics?.conversions ?? 0),
    conversionsValue: Number(row.metrics?.conversionsValue ?? 0),
  }))
}

export async function fetchGoogleAdsAdGroups(customerId: string, campaignId: string): Promise<GoogleAdsAdGroup[]> {
  const rows = await searchGoogleAds(
    customerId,
    `SELECT ad_group.id, ad_group.name, ad_group.campaign
     FROM ad_group
     WHERE campaign.id = ${Number(campaignId)} AND ad_group.status != 'REMOVED'
     ORDER BY ad_group.id`,
  )
  return rows.map((row) => ({ id: String(row.adGroup.id), name: row.adGroup.name, campaignId }))
}

export async function fetchGoogleAdsAds(customerId: string, adGroupId: string): Promise<GoogleAdsAd[]> {
  const rows = await searchGoogleAds(
    customerId,
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad_group
     FROM ad_group_ad
     WHERE ad_group.id = ${Number(adGroupId)} AND ad_group_ad.status != 'REMOVED'
     ORDER BY ad_group_ad.ad.id`,
  )
  return rows.map((row) => ({
    id: String(row.adGroupAd.ad.id),
    name: row.adGroupAd.ad.name || `Ad ${row.adGroupAd.ad.id}`,
    adGroupId,
  }))
}

/**
 * Creates a new campaign, always `status: PAUSED` (BRD Section 21: creating
 * is MEDIUM/automatic, launching is a separate HIGH/approval-gated
 * `update_campaign` call - same convention as Meta's `createMetaCampaign`).
 * Google Ads requires a linked `CampaignBudget` resource, created first in
 * its own mutate call (temporary cross-resource-type resource names aren't
 * reliable across two separate REST calls, so this uses the real resource
 * name the budget call returns rather than relying on one).
 */
export async function createGoogleAdsCampaign(
  customerId: string,
  input: { name: string; budget?: number },
): Promise<GoogleAdsCampaign> {
  const budgetMicros = toMicros(input.budget ?? 50)

  const budgetResult = await googleAdsFetch<{ results: Array<{ resourceName: string }> }>(customerId, 'campaignBudgets:mutate', {
    operations: [
      {
        create: {
          name: `${input.name} - Budget`,
          amountMicros: budgetMicros,
          deliveryMethod: 'STANDARD',
          explicitlyShared: false,
        },
      },
    ],
  })
  const budgetResourceName = budgetResult.results[0]?.resourceName
  if (!budgetResourceName) throw new Error('Google Ads did not return a budget resource name.')

  const campaignResult = await googleAdsFetch<{ results: Array<{ resourceName: string }> }>(customerId, 'campaigns:mutate', {
    operations: [
      {
        create: {
          name: input.name,
          status: 'PAUSED',
          advertisingChannelType: 'SEARCH',
          campaignBudget: budgetResourceName,
          // Manual CPC needs no conversion tracking configured, unlike
          // Maximize Conversions/Target CPA - the safest default for a
          // freshly created, unlaunched campaign.
          manualCpc: { enhancedCpcEnabled: false },
        },
      },
    ],
  })
  const campaignResourceName = campaignResult.results[0]?.resourceName
  if (!campaignResourceName) throw new Error('Google Ads did not return a campaign resource name.')
  const campaignId = campaignResourceName.split('/').pop()!

  return {
    id: campaignId,
    name: input.name,
    status: 'PAUSED',
    advertisingChannelType: 'SEARCH',
    budgetResourceName,
    budgetMicros,
  }
}

/** Pauses or re-activates a campaign. `resumeGoogleAdsCampaign` (status ENABLED) is only ever reached through the approval-gated `update_campaign` tool. */
export async function setGoogleAdsCampaignStatus(customerId: string, campaignId: string, status: 'PAUSED' | 'ENABLED'): Promise<void> {
  await googleAdsFetch(customerId, 'campaigns:mutate', {
    operations: [
      {
        update: { resourceName: `customers/${normalizeCustomerId(customerId)}/campaigns/${campaignId}`, status },
        // Google Ads' REST FieldMask paths are the proto (snake_case) field
        // names, not the camelCase names used in the resource JSON itself -
        // if a real account rejects this mask, try "status" unchanged first
        // (single-word fields don't actually differ between the two
        // conventions) before suspecting this line.
        updateMask: 'status',
      },
    ],
  })
}

/** Looks up a campaign's linked budget resource name, then updates its amount. Google Ads budgets are a separate resource from the campaign - there is no "set campaign budget" call. */
export async function updateGoogleAdsCampaignBudget(customerId: string, campaignId: string, budgetDollars: number): Promise<void> {
  const rows = await searchGoogleAds(customerId, `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${Number(campaignId)}`)
  const budgetResourceName = rows[0]?.campaign?.campaignBudget
  if (!budgetResourceName) throw new Error(`Could not resolve the campaign budget resource for campaign ${campaignId}.`)

  await googleAdsFetch(customerId, 'campaignBudgets:mutate', {
    operations: [
      {
        update: { resourceName: budgetResourceName, amountMicros: toMicros(budgetDollars) },
        updateMask: 'amount_micros',
      },
    ],
  })
}

/** Sets an ad group's manual CPC bid - Google Ads sets bids at the ad group (or keyword) level, never on an individual ad, so `providerAdId` here is treated as an ad group id (see provider.ts's doc comment on `updateBid`). */
export async function updateGoogleAdsAdGroupCpcBid(customerId: string, adGroupId: string, bidDollars: number): Promise<void> {
  await googleAdsFetch(customerId, 'adGroups:mutate', {
    operations: [
      {
        update: { resourceName: `customers/${normalizeCustomerId(customerId)}/adGroups/${adGroupId}`, cpcBidMicros: toMicros(bidDollars) },
        updateMask: 'cpc_bid_micros',
      },
    ],
  })
}

export { fromMicros, toMicros, normalizeCustomerId }
