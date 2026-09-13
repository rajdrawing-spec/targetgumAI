import { afterEach, describe, expect, it, vi } from 'vitest'
import { UnsupportedOperationError } from '@/lib/integrations/errors'
import { GoogleAdsMockProvider } from '@/lib/integrations/google-ads/mock-provider'
import { createGoogleAdsProvider } from '@/lib/integrations/google-ads/provider'
import { MetaAdsMockProvider } from '@/lib/integrations/meta-ads/mock-provider'
import { createMetaAdsProvider } from '@/lib/integrations/meta-ads/provider'
import type { AdsProvider } from '@/lib/integrations/providers'

const range = { from: '2026-01-01', to: '2026-01-31' }

/**
 * Phase 2 native Ads integration (BRD Section 51/85): `GoogleAdsMockProvider`/
 * `MetaAdsMockProvider` (BRD Section 92 names both explicitly) are what
 * every google_ads / meta_ads Tool Registry entry, agent, and test actually
 * exercises - the real adapters stay `UnsupportedOperationError` for every
 * method (docs/DECISIONS.md has the full reasoning: no verified client
 * library exists for either platform in this environment).
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

describe('Google Ads real adapter (not live-verified - no verified client library, see docs/EXTERNAL-APPROVALS.md)', () => {
  const provider = createGoogleAdsProvider() as Required<AdsProvider>
  it('every AdsProvider method throws UnsupportedOperationError', async () => {
    await expect(provider.getCampaigns('a', 'c')).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.getCampaignPerformance('a', 'c', range)).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.getAdGroups('a', 'c1')).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.getAds('a', 'ag1')).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.createCampaign('a', {})).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.updateCampaign('c1', {})).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.pauseCampaign('c1')).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.updateBudget('c1', 100)).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.updateBid('a1', 1)).rejects.toThrow(UnsupportedOperationError)
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

  it('createCampaign requires a name', async () => {
    const withToken = createMetaAdsProvider('fake-token') as Required<AdsProvider>
    await expect(withToken.createCampaign('act_123', {})).rejects.toThrow('A campaign name is required.')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
})

