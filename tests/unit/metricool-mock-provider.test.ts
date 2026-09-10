import { describe, expect, it } from 'vitest'
import { MetricoolMockProvider } from '@/lib/integrations/metricool/mock-provider'

const range = { from: '2026-01-01', to: '2026-01-31' }

describe('MetricoolMockProvider (BRD Section 92 - full interface, no network)', () => {
  it('implements the full social post lifecycle: create -> schedule -> publish -> list', async () => {
    const created = await MetricoolMockProvider.createPost({
      brandId: 'brand-1',
      networks: ['instagram'],
      text: 'Hello world',
      scheduledAt: '2026-02-01T10:00:00Z',
    })
    expect(created.status).toBe('draft')

    const scheduled = await MetricoolMockProvider.schedulePost({
      brandId: 'brand-1',
      networks: ['instagram'],
      text: 'Scheduled post',
      scheduledAt: '2026-02-01T10:00:00Z',
    })
    expect(scheduled.status).toBe('scheduled')

    const published = await MetricoolMockProvider.publishPost(scheduled.providerPostId)
    expect(published.status).toBe('published')
    expect(published.publishedAt).toBeTruthy()

    const posts = await MetricoolMockProvider.getPosts('brand-1', range)
    expect(posts.some((p) => p.providerPostId === scheduled.providerPostId)).toBe(true)
  })

  it('throws for publishPost on an unknown post id', async () => {
    await expect(MetricoolMockProvider.publishPost('does-not-exist')).rejects.toThrow()
  })

  it('returns deterministic analytics with provenance', async () => {
    const analytics = await MetricoolMockProvider.getAnalytics('brand-1', 'instagram', range)
    expect(analytics).toHaveLength(1)
    expect(analytics[0]).toMatchObject({ source: 'metricool-mock', period: `${range.from}..${range.to}` })
    expect(typeof analytics[0]?.impressions).toBe('number')
  })

  it('lists connected networks', async () => {
    const networks = await MetricoolMockProvider.getConnectedNetworks('brand-1')
    expect(networks.length).toBeGreaterThan(0)
  })

  it('supports the full AdsProvider write surface (mock only - the real adapter cannot)', async () => {
    const campaign = await MetricoolMockProvider.createCampaign('brand-1', {
      name: 'New Campaign',
      channel: 'googleAds',
      budget: 100,
    })
    expect(campaign.name).toBe('New Campaign')

    const updated = await MetricoolMockProvider.updateCampaign(campaign.providerCampaignId, { budget: 200 })
    expect(updated.budget).toBe(200)

    await MetricoolMockProvider.pauseCampaign(campaign.providerCampaignId)
    const campaigns = await MetricoolMockProvider.getCampaigns('brand-1', 'googleAds')
    expect(campaigns.find((c) => c.providerCampaignId === campaign.providerCampaignId)?.status).toBe('PAUSED')

    await MetricoolMockProvider.updateBudget(campaign.providerCampaignId, 300)
    await expect(MetricoolMockProvider.updateBid('ad-1', 1.5)).resolves.toBeUndefined()
  })

  it('returns campaign performance with full normalized metrics and provenance', async () => {
    const performance = await MetricoolMockProvider.getCampaignPerformance('brand-1', 'googleAds', range)
    expect(performance.length).toBeGreaterThan(0)
    expect(performance[0]).toMatchObject({ source: 'metricool-mock' })
    expect(typeof performance[0]?.roas).toBe('number')
  })

  it('returns ad groups and ads scoped to the given campaign/ad group id', async () => {
    const adGroups = await MetricoolMockProvider.getAdGroups('brand-1', 'campaign-1')
    expect(adGroups[0]?.providerCampaignId).toBe('campaign-1')
    const ads = await MetricoolMockProvider.getAds('brand-1', adGroups[0]!.providerAdGroupId)
    expect(ads[0]?.providerAdGroupId).toBe(adGroups[0]!.providerAdGroupId)
  })
})
