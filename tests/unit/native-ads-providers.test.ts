import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { UnsupportedOperationError } from '@/lib/integrations/errors'
import { _resetGoogleAdsTokenCacheForTests } from '@/lib/integrations/google-ads/google-ads-client'
import { GoogleAdsMockProvider } from '@/lib/integrations/google-ads/mock-provider'
import { createGoogleAdsProvider } from '@/lib/integrations/google-ads/provider'
import { MetaAdsMockProvider } from '@/lib/integrations/meta-ads/mock-provider'
import { createMetaAdsProvider } from '@/lib/integrations/meta-ads/provider'
import type { AdsProvider } from '@/lib/integrations/providers'

const range = { from: '2026-01-01', to: '2026-01-31' }

/**
 * Phase 2 native Ads integration (BRD Section 51/85): `GoogleAdsMockProvider`/
 * `MetaAdsMockProvider` (BRD Section 92 names both explicitly) are what
 * every google_ads / meta_ads Tool Registry entry, agent, and test exercises
 * when no real credentials are configured (`GOOGLE_ADS_DEVELOPER_TOKEN`/
 * `META_ACCESS_TOKEN` - see `resolveGoogleAdsProvider`/`resolveMetaAdsProvider`).
 * Both real adapters are now implemented against their platform's
 * documented API - see each one's own describe block below for what's
 * verified and what remains "not live-verified" (docs/DECISIONS.md).
 */
describe.each([
  ['Google Ads', GoogleAdsMockProvider, 'google_ads', 'google-ads-mock'] as const,
  ['Meta Ads', MetaAdsMockProvider, 'meta_ads', 'meta-ads-mock'] as const,
])('%s mock provider (BRD Section 92 - full AdsProvider interface, no network)', (_label, provider, channel, source) => {
  it('lists the seeded campaigns for the right channel only', async () => {
    const campaigns = await provider.getCampaigns('account-1', channel)
    expect(campaigns.length).toBeGreaterThan(0)
    expect(campaigns.every((c) => c.channel === channel)).toBe(true)
  })

  it('returns campaign performance with provenance for the seeded campaigns', async () => {
    const performance = await provider.getCampaignPerformance('account-1', channel, range)
    expect(performance.length).toBeGreaterThan(0)
    expect(performance[0]).toMatchObject({ source, period: `${range.from}..${range.to}` })
    expect(typeof performance[0]?.roas).toBe('number')
  })

  it('returns ad groups and ads scoped to the seeded campaign/ad group', async () => {
    const campaigns = await provider.getCampaigns('account-1', channel)
    const adGroups = await provider.getAdGroups('account-1', campaigns[0]!.providerCampaignId)
    expect(adGroups.length).toBeGreaterThan(0)
    expect(adGroups[0]?.providerCampaignId).toBe(campaigns[0]!.providerCampaignId)

    const ads = await provider.getAds('account-1', adGroups[0]!.providerAdGroupId)
    expect(ads.length).toBeGreaterThan(0)
    expect(ads[0]?.providerAdGroupId).toBe(adGroups[0]!.providerAdGroupId)
  })

  it('createCampaign always creates a PAUSED campaign, never live (BRD Section 21: launching is a separate HIGH-risk action)', async () => {
    const campaign = await provider.createCampaign!('account-1', { name: 'New Campaign', budget: 100 })
    expect(campaign.status).toBe('PAUSED')
    expect(campaign.name).toBe('New Campaign')

    const campaigns = await provider.getCampaigns('account-1', channel)
    expect(campaigns.find((c) => c.providerCampaignId === campaign.providerCampaignId)?.status).toBe('PAUSED')
  })

  it('updateCampaign/pauseCampaign/updateBudget mutate the stored campaign in place', async () => {
    const campaign = await provider.createCampaign!('account-1', { name: 'Mutable Campaign', budget: 50 })

    const updated = await provider.updateCampaign!(campaign.providerCampaignId, { name: 'Renamed Campaign' })
    expect(updated.name).toBe('Renamed Campaign')

    await provider.updateBudget!(campaign.providerCampaignId, 250)
    const afterBudget = await provider.getCampaigns('account-1', channel)
    expect(afterBudget.find((c) => c.providerCampaignId === campaign.providerCampaignId)?.budget).toBe(250)

    await provider.pauseCampaign!(campaign.providerCampaignId)
    const afterPause = await provider.getCampaigns('account-1', channel)
    expect(afterPause.find((c) => c.providerCampaignId === campaign.providerCampaignId)?.status).toBe('PAUSED')
  })

  it('updateBid resolves (no-op, same simplification MetricoolMockProvider makes)', async () => {
    await expect(provider.updateBid!('ad-1', 1.5)).resolves.toBeUndefined()
  })

  it('throws for updateCampaign/updateBudget/pauseCampaign on an unknown campaign id', async () => {
    await expect(provider.updateCampaign!('does-not-exist', {})).rejects.toThrow()
    await expect(provider.updateBudget!('does-not-exist', 10)).rejects.toThrow()
    await expect(provider.pauseCampaign!('does-not-exist')).rejects.toThrow()
  })
})

/**
 * Google Ads real adapter (v18 REST + GAQL) - not live-verified, no
 * developer token/OAuth client/test account exists in this environment
 * (docs/EXTERNAL-APPROVALS.md). What these tests DO establish: every
 * request this code sends matches google-ads-client.ts's documented shape
 * exactly - method, URL, headers, and body - so once real credentials
 * exist, any mismatch against Google's actual API is a small, isolated fix
 * to one assertion here, not a systemic guess. `fetch` is mocked for both
 * the OAuth token endpoint and the Google Ads API itself.
 */
describe('Google Ads real adapter (v18 REST/GAQL)', () => {
  function mockGoogleAdsFetch(handleApiCall: (url: string, init: RequestInit) => Response) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === 'https://oauth2.googleapis.com/token') {
        const params = new URLSearchParams(init?.body as string)
        expect(params.get('grant_type')).toBe('refresh_token')
        expect(params.get('refresh_token')).toBe('test-refresh-token')
        return new Response(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600 }), { status: 200 })
      }
      return handleApiCall(url, init!)
    })
  }

  beforeAll(() => {
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'test-dev-token')
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'test-client-id')
    vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', 'test-refresh-token')
    vi.stubEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '111-222-3333')
  })
  afterAll(() => vi.unstubAllEnvs())

  afterEach(() => {
    vi.unstubAllGlobals()
    _resetGoogleAdsTokenCacheForTests()
  })

  it('getCampaigns runs a GAQL search with the right headers and parses budget from micros', async () => {
    const fetchMock = mockGoogleAdsFetch((url, init) => {
      expect(url).toContain('/v18/customers/4445556666/googleAds:search')
      expect(init.method).toBe('POST')
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer test-access-token')
      expect(headers['developer-token']).toBe('test-dev-token')
      expect(headers['login-customer-id']).toBe('1112223333') // dashes stripped
      const body = JSON.parse(init.body as string)
      expect(body.query).toContain('FROM campaign')
      return new Response(
        JSON.stringify({
          results: [
            {
              campaign: { id: '999', name: 'Search - Brand', status: 'ENABLED', campaignBudget: 'customers/444/campaignBudgets/1' },
              campaignBudget: { amountMicros: '50000000' },
            },
          ],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider()
    const campaigns = await provider.getCampaigns('444-555-6666', 'google_ads')
    expect(campaigns).toEqual([
      { providerCampaignId: '999', name: 'Search - Brand', channel: 'google_ads', status: 'ENABLED', budget: 50, startDate: undefined, endDate: undefined },
    ])
  })

  it('getCampaignPerformance converts GAQL ctr (0-1 ratio) to a percentage and computes ROAS', async () => {
    const fetchMock = mockGoogleAdsFetch(() =>
      new Response(
        JSON.stringify({
          results: [
            {
              campaign: { id: '999' },
              segments: { date: '2026-01-15' },
              metrics: { impressions: '1000', clicks: '40', costMicros: '20000000', ctr: '0.04', averageCpc: '500000', conversions: '5', conversionsValue: '100' },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider()
    const [perf] = await provider.getCampaignPerformance('4445556666', 'google_ads', range)
    expect(perf).toMatchObject({ providerCampaignId: '999', spend: 20, clicks: 40, ctr: 4, cpc: 0.5, conversions: 5, revenue: 100, roas: 5 })
  })

  it('createCampaign creates the budget first, then a PAUSED campaign linked to it', async () => {
    const calls: string[] = []
    const fetchMock = mockGoogleAdsFetch((url, init) => {
      const body = JSON.parse(init.body as string)
      if (url.endsWith('campaignBudgets:mutate')) {
        calls.push('budget')
        expect(body.operations[0].create.amountMicros).toBe(30_000_000)
        expect(body.operations[0].create.explicitlyShared).toBe(false)
        return new Response(JSON.stringify({ results: [{ resourceName: 'customers/4445556666/campaignBudgets/777' }] }), { status: 200 })
      }
      if (url.endsWith('campaigns:mutate')) {
        calls.push('campaign')
        expect(body.operations[0].create.status).toBe('PAUSED')
        expect(body.operations[0].create.campaignBudget).toBe('customers/4445556666/campaignBudgets/777')
        expect(body.operations[0].create.advertisingChannelType).toBe('SEARCH')
        return new Response(JSON.stringify({ results: [{ resourceName: 'customers/4445556666/campaigns/888' }] }), { status: 200 })
      }
      throw new Error(`unexpected URL ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider()
    const campaign = await provider.createCampaign('4445556666', { name: 'New Search Campaign', budget: 30 })
    expect(calls).toEqual(['budget', 'campaign']) // budget must be created (and its real resourceName known) before the campaign references it
    expect(campaign).toMatchObject({ providerCampaignId: '888', name: 'New Search Campaign', status: 'PAUSED', budget: 30 })
  })

  it('pauseCampaign requires an accountId - the shared AdsProvider interface has no room for one, so it comes from the factory', async () => {
    const provider = createGoogleAdsProvider() // no accountId
    await expect(provider.pauseCampaign('888')).rejects.toThrow(/target customer account id/)
  })

  it('pauseCampaign (with accountId) sends status=PAUSED for the right campaign', async () => {
    const fetchMock = mockGoogleAdsFetch((url, init) => {
      expect(url).toContain('/customers/4445556666/campaigns:mutate')
      const body = JSON.parse(init.body as string)
      expect(body.operations[0].update.resourceName).toBe('customers/4445556666/campaigns/888')
      expect(body.operations[0].update.status).toBe('PAUSED')
      expect(body.operations[0].updateMask).toBe('status')
      return new Response(JSON.stringify({ results: [{ resourceName: 'customers/4445556666/campaigns/888' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider('4445556666')
    await expect(provider.pauseCampaign('888')).resolves.toBeUndefined()
  })

  it('updateCampaign({status: ACTIVE}) looks up nothing extra and sends status=ENABLED - re-activating is a real call, not a local-only flip', async () => {
    const fetchMock = mockGoogleAdsFetch((url, init) => {
      const body = JSON.parse(init.body as string)
      expect(body.operations[0].update.status).toBe('ENABLED')
      return new Response(JSON.stringify({ results: [{ resourceName: 'customers/4445556666/campaigns/888' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider('4445556666')
    const updated = await provider.updateCampaign('888', { status: 'ACTIVE' })
    expect(updated.status).toBe('ACTIVE')
  })

  it('updateBudget looks up the campaign\'s linked budget resource, then updates its amount', async () => {
    const fetchMock = mockGoogleAdsFetch((url, init) => {
      const body = JSON.parse(init.body as string)
      if (url.endsWith('googleAds:search')) {
        expect(body.query).toContain('campaign.campaign_budget')
        return new Response(JSON.stringify({ results: [{ campaign: { campaignBudget: 'customers/4445556666/campaignBudgets/777' } }] }), { status: 200 })
      }
      expect(url).toContain('campaignBudgets:mutate')
      expect(body.operations[0].update.resourceName).toBe('customers/4445556666/campaignBudgets/777')
      expect(body.operations[0].update.amountMicros).toBe(75_000_000)
      expect(body.operations[0].updateMask).toBe('amount_micros')
      return new Response(JSON.stringify({ results: [{ resourceName: 'customers/4445556666/campaignBudgets/777' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider('4445556666')
    await expect(provider.updateBudget('888', 75)).resolves.toBeUndefined()
  })

  it('updateBid sets cpcBidMicros on the ad group', async () => {
    const fetchMock = mockGoogleAdsFetch((url, init) => {
      expect(url).toContain('adGroups:mutate')
      const body = JSON.parse(init.body as string)
      expect(body.operations[0].update.cpcBidMicros).toBe(1_500_000)
      expect(body.operations[0].updateMask).toBe('cpc_bid_micros')
      return new Response(JSON.stringify({ results: [{ resourceName: 'customers/4445556666/adGroups/55' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider('4445556666')
    await expect(provider.updateBid('55', 1.5)).resolves.toBeUndefined()
  })

  it('surfaces the Google Ads API error message on a failed call, not a generic one', async () => {
    const fetchMock = mockGoogleAdsFetch(() =>
      new Response(
        JSON.stringify({ error: { code: 400, message: 'Request contains an invalid argument.', details: [{ errors: [{ message: 'The campaign budget amount is too low.' }] }] } }),
        { status: 400 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleAdsProvider()
    await expect(provider.getCampaigns('4445556666', 'google_ads')).rejects.toThrow('The campaign budget amount is too low.')
  })
})

describe('Meta Ads real adapter (Graph API v20.0)', () => {
  const provider = createMetaAdsProvider() as Required<AdsProvider>
  it('fails fast when META_ACCESS_TOKEN is not configured', async () => {
    await expect(provider.getCampaigns('a', 'meta_ads')).rejects.toThrow('Meta Ads API Access Token not configured')
    await expect(provider.getCampaignPerformance('a', 'meta_ads', range)).rejects.toThrow('Meta Ads API Access Token not configured')
  })

  it('createCampaign always POSTs status=PAUSED to the Graph API, never live (BRD Section 21) - no network hit', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      expect(url).toContain('/act_123/campaigns')
      expect(url).toContain('access_token=fake-token')
      return new Response(JSON.stringify({ id: '120987654321' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const withToken = createMetaAdsProvider('fake-token') as Required<AdsProvider>
    const campaign = await withToken.createCampaign('act_123', { name: 'New Meta Campaign', budget: 40 })

    expect(campaign).toMatchObject({
      providerCampaignId: '120987654321',
      name: 'New Meta Campaign',
      channel: 'meta_ads',
      status: 'PAUSED',
      budget: 40,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]!
    expect(init?.method).toBe('POST')
    const sentParams = new URLSearchParams(init?.body as string)
    expect(sentParams.get('status')).toBe('PAUSED')
    expect(sentParams.get('name')).toBe('New Meta Campaign')
    expect(sentParams.get('special_ad_categories')).toBe('[]')
    expect(sentParams.get('daily_budget')).toBe('4000') // $40.00 -> cents
  })

  it('updateCampaign({status: ACTIVE}) actually POSTs status=ACTIVE to the Graph API - re-activating is not a no-op', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const withToken = createMetaAdsProvider('fake-token') as Required<AdsProvider>
    await withToken.updateCampaign('999888777', { status: 'ACTIVE' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/999888777')
    const sentParams = new URLSearchParams(init?.body as string)
    expect(sentParams.get('status')).toBe('ACTIVE')
  })

  it('createCampaign requires a name', async () => {
    const withToken = createMetaAdsProvider('fake-token') as Required<AdsProvider>
    await expect(withToken.createCampaign('act_123', {})).rejects.toThrow('A campaign name is required.')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
})

