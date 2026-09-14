/**
 * Meta Ads (Graph API v20.0) Production Marketing API Client
 *
 * Implements direct, type-safe HTTPS communication with Meta's Graph API.
 * Supports verifying credentials, reading ad accounts, campaigns, ad sets,
 * and live daily insights telemetry (impressions, clicks, spend, CTR, ROAS).
 */

const META_GRAPH_BASE = 'https://graph.facebook.com/v20.0'

export interface MetaAdAccount {
  id: string // e.g. "act_1234567890"
  accountId: string // e.g. "1234567890"
  name: string
  accountStatus: number
  currency: string
  timezoneName: string
  amountSpent: number
}

export interface MetaCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED' | string
  objective?: string
  dailyBudget?: number // In major currency units (e.g. $10.00)
  lifetimeBudget?: number
  startTime?: string
  stopTime?: string
  createdTime?: string
  updatedTime?: string
}

export interface MetaDailyInsight {
  campaignId: string
  campaignName: string
  date: string // YYYY-MM-DD
  impressions: number
  clicks: number
  spend: number // In major currency units
  ctr: number // Percentage (e.g. 2.45)
  cpc: number
  cpm: number
  reach: number
  frequency: number
  conversions: number
  revenue: number
  roas: number
  raw: Record<string, unknown>
}

export interface MetaUserContext {
  id: string
  name: string
}

function normalizeAdAccountId(rawId: string): string {
  const trimmed = rawId.trim()
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`
}

async function metaFetch<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${META_GRAPH_BASE}${endpoint}`
  const separator = url.includes('?') ? '&' : '?'
  const authedUrl = `${url}${separator}access_token=${encodeURIComponent(token)}`

  const res = await fetch(authedUrl, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
    // Don't cache live telemetry
    cache: 'no-store',
  })

  const json = await res.json()

  if (!res.ok || json.error) {
    const errorObj = json.error || {}
    const message = errorObj.message || `Meta Graph API error (status ${res.status})`
    const type = errorObj.type || 'MetaApiException'
    const code = errorObj.code || res.status
    throw new Error(`[Meta API ${code} - ${type}]: ${message}`)
  }

  return json as T
}

/**
 * Validates a Meta Access Token by verifying identity against /me.
 */
export async function verifyMetaCredentials(token: string): Promise<MetaUserContext> {
  if (!token?.trim()) {
    throw new Error('Meta Access Token is required.')
  }
  const result = await metaFetch<{ id: string; name: string }>('/me?fields=id,name', token.trim())
  return {
    id: result.id,
    name: result.name,
  }
}

/**
 * Fetches all ad accounts accessible by the provided token.
 */
export async function fetchMetaAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const response = await metaFetch<{
    data: Array<{
      id: string
      account_id: string
      name: string
      account_status: number
      currency: string
      timezone_name: string
      amount_spent?: string
    }>
  }>('/me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name,amount_spent&limit=50', token.trim())

  return (response.data || []).map((acc) => ({
    id: acc.id,
    accountId: acc.account_id,
    name: acc.name || `Ad Account ${acc.account_id}`,
    accountStatus: acc.account_status,
    currency: acc.currency || 'USD',
    timezoneName: acc.timezone_name,
    amountSpent: acc.amount_spent ? Number(acc.amount_spent) / 100 : 0,
  }))
}

/**
 * Fetches campaigns for a given Meta Ad Account.
 */
export async function fetchMetaCampaigns(adAccountId: string, token: string): Promise<MetaCampaign[]> {
  const actId = normalizeAdAccountId(adAccountId)
  const response = await metaFetch<{
    data: Array<{
      id: string
      name: string
      status: string
      objective?: string
      daily_budget?: string
      lifetime_budget?: string
      start_time?: string
      stop_time?: string
      created_time?: string
      updated_time?: string
    }>
  }>(
    `/${actId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time&limit=100`,
    token.trim(),
  )

  return (response.data || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    // Meta returns budgets in basic cents, e.g. 5000 = $50.00
    dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : undefined,
    lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : undefined,
    startTime: c.start_time,
    stopTime: c.stop_time,
    createdTime: c.created_time,
    updatedTime: c.updated_time,
  }))
}

function parseInsightRow(row: any, fallbackCampaignId?: string, fallbackCampaignName?: string): MetaDailyInsight {
  const spend = row.spend ? parseFloat(row.spend) : 0
  const impressions = row.impressions ? parseInt(row.impressions, 10) : 0
  const clicks = row.clicks ? parseInt(row.clicks, 10) : 0
  const ctr = row.ctr ? parseFloat(row.ctr) : impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpc = row.cpc ? parseFloat(row.cpc) : clicks > 0 ? spend / clicks : 0
  const cpm = row.cpm ? parseFloat(row.cpm) : impressions > 0 ? (spend / impressions) * 1000 : 0

  // Extract conversions from actions
  let conversions = 0
  if (row.actions) {
    for (const a of row.actions) {
      if (
        a.action_type === 'omni_purchase' ||
        a.action_type === 'purchase' ||
        a.action_type === 'lead' ||
        a.action_type === 'offsite_conversion.fb_pixel_purchase'
      ) {
        conversions += parseInt(a.value, 10) || 0
      }
    }
  }

  // Extract revenue from action_values
  let revenue = 0
  if (row.action_values) {
    for (const av of row.action_values) {
      if (
        av.action_type === 'omni_purchase' ||
        av.action_type === 'purchase' ||
        av.action_type === 'offsite_conversion.fb_pixel_purchase'
      ) {
        revenue += parseFloat(av.value) || 0
      }
    }
  }

  // Calculate ROAS
  let roas = 0
  if (row.purchase_roas && row.purchase_roas.length > 0) {
    roas = parseFloat(row.purchase_roas[0]?.value || '0') || 0
  } else if (spend > 0 && revenue > 0) {
    roas = Number((revenue / spend).toFixed(2))
  }

  return {
    campaignId: row.campaign_id || fallbackCampaignId || '',
    campaignName: row.campaign_name || fallbackCampaignName || '',
    date: row.date_start || new Date().toISOString().slice(0, 10),
    impressions,
    clicks,
    spend: Number(spend.toFixed(2)),
    ctr: Number(ctr.toFixed(2)),
    cpc: Number(cpc.toFixed(2)),
    cpm: Number(cpm.toFixed(2)),
    reach: row.reach ? parseInt(row.reach, 10) : impressions,
    frequency: row.frequency ? parseFloat(row.frequency) : 1,
    conversions,
    revenue: Number(revenue.toFixed(2)),
    roas: Number(roas.toFixed(2)),
    raw: row as unknown as Record<string, unknown>,
  }
}

/**
 * Fetches real daily performance insights for a Meta Ad Account.
 * Crucially specifies level=campaign so Meta returns per-campaign insights with campaign_id.
 */
export async function fetchMetaDailyInsights(
  adAccountId: string,
  token: string,
  options: { fromDate?: string; toDate?: string; datePreset?: string } = {},
): Promise<MetaDailyInsight[]> {
  const actId = normalizeAdAccountId(adAccountId)
  const dateParam =
    options.fromDate && options.toDate
      ? `time_range={"since":"${options.fromDate}","until":"${options.toDate}"}`
      : `date_preset=${options.datePreset || 'last_30d'}`

  // level=campaign is mandatory for Meta to group insights by campaign and return campaign_id
  const url = `/${actId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values,purchase_roas,date_start,date_stop&time_increment=1&${dateParam}&limit=500`

  const response = await metaFetch<{
    data: Array<{
      campaign_id: string
      campaign_name: string
      date_start: string
      date_stop: string
      impressions?: string
      clicks?: string
      spend?: string
      cpc?: string
      cpm?: string
      ctr?: string
      reach?: string
      frequency?: string
      actions?: Array<{ action_type: string; value: string }>
      action_values?: Array<{ action_type: string; value: string }>
      purchase_roas?: Array<{ action_type: string; value: string }>
    }>
  }>(url, token.trim())

  return (response.data || []).map((row) => parseInsightRow(row))
}

/**
 * Fetches insights directly for a specific Meta Campaign.
 * Supports querying lifetime summary (timeIncrement undefined) or daily series (timeIncrement=1).
 */
export async function fetchCampaignInsights(
  campaignId: string,
  token: string,
  options: { fromDate?: string; toDate?: string; datePreset?: string; timeIncrement?: number } = {},
): Promise<MetaDailyInsight[]> {
  const dateParam =
    options.fromDate && options.toDate
      ? `time_range={"since":"${options.fromDate}","until":"${options.toDate}"}`
      : `date_preset=${options.datePreset || 'maximum'}`

  const timeIncParam = options.timeIncrement !== undefined ? `&time_increment=${options.timeIncrement}` : ''
  const url = `/${campaignId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values,purchase_roas,date_start,date_stop${timeIncParam}&${dateParam}&limit=100`

  try {
    const response = await metaFetch<{
      data: Array<any>
    }>(url, token.trim())

    return (response.data || []).map((row) => parseInsightRow(row, campaignId))
  } catch (error) {
    console.warn(`[Meta API] Failed to fetch direct insights for campaign ${campaignId}:`, error)
    return []
  }
}

/**
 * Creates a new Meta Campaign - always `status: PAUSED` (BRD Section 21:
 * "create draft campaign" is MEDIUM/automatic, "launch campaign" is HIGH/
 * approval-required; actually activating this campaign is a separate
 * `updateCampaign` call gated accordingly, see meta-ads/tools.ts). Meta's
 * Marketing API requires both `objective` and `special_ad_categories` on
 * every campaign; no UI upstream of this collects either today, so this
 * defaults to a generic conversion-adjacent objective and "no special
 * category" (regulated categories - housing/credit/employment/politics -
 * are deliberately not supported until a real intake flow exists for them).
 */
export async function createMetaCampaign(
  adAccountId: string,
  token: string,
  input: { name: string; budget?: number; objective?: string },
): Promise<MetaCampaign> {
  const actId = normalizeAdAccountId(adAccountId)
  const body: Record<string, string> = {
    name: input.name,
    objective: input.objective || 'OUTCOME_TRAFFIC',
    status: 'PAUSED',
    special_ad_categories: JSON.stringify([]),
  }
  if (input.budget !== undefined) {
    // Campaign-level daily_budget opts the campaign into Advantage Campaign
    // Budget (formerly CBO) - matches this app's create_campaign input,
    // which takes one budget per campaign, not per ad set.
    body.daily_budget = Math.round(input.budget * 100).toString()
  }

  const created = await metaFetch<{ id: string }>(`/${actId}/campaigns`, token.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  return {
    id: created.id,
    name: input.name,
    status: 'PAUSED',
    objective: body.objective,
    dailyBudget: input.budget,
  }
}

/**
 * Pauses an active Meta Campaign.
 */
export async function pauseMetaCampaign(campaignId: string, token: string): Promise<void> {
  await metaFetch(`/${campaignId}`, token.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'PAUSED' }).toString(),
  })
}

/**
 * Re-activates a paused Meta Campaign. Only reachable through the
 * approval-gated `meta_ads.update_campaign` tool (BRD Section 21: like
 * "launch campaign", HIGH risk) - never called on a fresh, unapproved
 * request.
 */
export async function resumeMetaCampaign(campaignId: string, token: string): Promise<void> {
  await metaFetch(`/${campaignId}`, token.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'ACTIVE' }).toString(),
  })
}

/**
 * Updates the daily budget of an active Meta Campaign.
 */
export async function updateMetaCampaignBudget(
  campaignId: string,
  dailyBudgetDollars: number,
  token: string,
): Promise<void> {
  // Convert dollars to cents for Meta Graph API
  const cents = Math.round(dailyBudgetDollars * 100)
  await metaFetch(`/${campaignId}`, token.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ daily_budget: cents.toString() }).toString(),
  })
}
