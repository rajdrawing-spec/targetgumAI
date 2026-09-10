import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetMetricoolClientForTests,
  setMetricoolClientForTests,
} from '@/lib/integrations/metricool/mcp-client'
import { MetricoolProvider } from '@/lib/integrations/metricool/provider'
import { UnsupportedOperationError } from '@/lib/integrations/errors'

function textResult(data: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

function mockCallTool() {
  const callTool = vi.fn()
  const fakeClient = { callTool } as unknown as Client
  setMetricoolClientForTests(fakeClient)
  return callTool
}

describe('MetricoolProvider (real adapter, injected fake MCP client - no live network)', () => {
  beforeEach(() => {
    process.env.METRICOOL_MCP_URL = 'https://mcp.example.test/metricool'
  })

  afterEach(() => {
    resetMetricoolClientForTests()
    delete process.env.METRICOOL_MCP_URL
  })

  it('getConnectedNetworks filters to the requested brand and excludes ads-only keys', async () => {
    const callTool = mockCallTool()
    callTool.mockResolvedValueOnce(
      textResult({
        data: [
          {
            id: 111,
            label: 'Other Brand',
            networksData: { facebookData: 'other_fb' },
          },
          {
            id: 222,
            label: 'Target Brand',
            networksData: {
              instagramData: 'target_ig_handle',
              facebookAdsData: 'act_123', // must be excluded - ads account, not a social network
            },
          },
        ],
      }),
    )

    const networks = await MetricoolProvider.getConnectedNetworks('222')
    expect(networks).toEqual([{ network: 'instagram', externalId: 'target_ig_handle' }])
  })

  it('throws a clear error when the requested brand id is not found', async () => {
    const callTool = mockCallTool()
    callTool.mockResolvedValueOnce(textResult({ data: [{ id: 111, networksData: {} }] }))
    await expect(MetricoolProvider.getConnectedNetworks('999')).rejects.toThrow(/No Metricool brand/)
  })

  it('schedulePost/createPost always send draft:true to Metricool, regardless of caller intent (safety invariant, see docs/DECISIONS.md)', async () => {
    const callTool = mockCallTool()
    callTool.mockResolvedValueOnce(textResult({ id: 'post-1', providers: [{ network: 'instagram' }], text: 'hi' }))

    await MetricoolProvider.schedulePost({
      brandId: '222',
      networks: ['instagram'],
      text: 'hi',
      scheduledAt: '2026-02-01T10:00:00Z',
    })

    expect(callTool).toHaveBeenCalledTimes(1)
    const call = callTool.mock.calls[0]![0] as { name: string; arguments: { info: string } }
    expect(call.name).toBe('createScheduledPost')
    const info = JSON.parse(call.arguments.info)
    expect(info.draft).toBe(true)
    expect(info.autoPublish).toBe(false)
  })

  it('publishPost is unimplemented (no verified Metricool tool can trigger real publication)', async () => {
    await expect(MetricoolProvider.publishPost('post-1')).rejects.toThrow(UnsupportedOperationError)
  })

  it('every AdsProvider write method throws UnsupportedOperationError (Metricool has no ads write endpoints)', async () => {
    await expect(MetricoolProvider.createCampaign!('222', {})).rejects.toThrow(UnsupportedOperationError)
    await expect(MetricoolProvider.updateCampaign!('c1', {})).rejects.toThrow(UnsupportedOperationError)
    await expect(MetricoolProvider.pauseCampaign!('c1')).rejects.toThrow(UnsupportedOperationError)
    await expect(MetricoolProvider.updateBudget!('c1', 100)).rejects.toThrow(UnsupportedOperationError)
    await expect(MetricoolProvider.updateBid!('a1', 1)).rejects.toThrow(UnsupportedOperationError)
    await expect(MetricoolProvider.getAdGroups!('222', 'c1')).rejects.toThrow(UnsupportedOperationError)
    await expect(MetricoolProvider.getAds!('222', 'ag1')).rejects.toThrow(UnsupportedOperationError)
  })

  it('propagates a tool-level MCP error as a JS error', async () => {
    const callTool = mockCallTool()
    callTool.mockResolvedValueOnce({ isError: true, content: [{ type: 'text', text: 'brand not authorized' }] })
    await expect(MetricoolProvider.getConnectedNetworks('222')).rejects.toThrow(/brand not authorized/)
  })

  /**
   * `getAnalytics`/`getCampaigns`/`getCampaignPerformance` all parse
   * `getAnalyticsDataByMetrics`'s response. Its real shape - verified live
   * against a real brand during Day 15 pilot-readiness work - is
   * `{ rows: [[...values in `metrics` order..., "YYYYMMDD"]] }`, numeric
   * values as strings, NOT the `fieldId`-keyed object originally assumed.
   * These tests pin down that real shape so a future change can't silently
   * regress back to the bug these fixed (every metric coming back
   * `undefined`).
   */
  describe('getAnalyticsDataByMetrics real response shape ({ rows: [[...]] })', () => {
    it('getAnalytics maps one SocialMetricValue per row, by position, with dates parsed from the trailing element', async () => {
      const callTool = mockCallTool()
      callTool.mockResolvedValueOnce(
        textResult([
          { fieldId: 'IGEV01', metricName: 'followers' },
          { fieldId: 'IGEV06', metricName: 'reach' },
          { fieldId: 'IGEV09', metricName: 'interactions' },
        ]),
      )
      callTool.mockResolvedValueOnce(
        textResult({
          rows: [
            ['170.0', '0.0', null, '20260831'],
            ['169.0', '12.0', '3.0', '20260907'],
          ],
        }),
      )

      const values = await MetricoolProvider.getAnalytics('222', 'instagram', { from: '2026-08-01', to: '2026-09-07' })

      expect(values).toHaveLength(2)
      expect(values[0]).toMatchObject({ followers: 170, reach: 0, period: '2026-08-31' })
      expect(values[0]?.engagement).toBeUndefined() // null in the response -> not set, not 0/NaN
      expect(values[1]).toMatchObject({ followers: 169, reach: 12, engagement: 3, period: '2026-09-07' })
    })

    it('getAnalytics returns [] when no metrics are available for the network/connector', async () => {
      const callTool = mockCallTool()
      callTool.mockResolvedValueOnce(textResult([]))
      const values = await MetricoolProvider.getAnalytics('222', 'instagram', { from: '2026-08-01', to: '2026-09-07' })
      expect(values).toEqual([])
      expect(callTool).toHaveBeenCalledTimes(1) // never calls getAnalyticsDataByMetrics with an empty metrics list
    })

    it('getCampaigns reads the campaign name from its positional slot in each row (names are strings, not numbers)', async () => {
      const callTool = mockCallTool()
      callTool.mockResolvedValueOnce(
        textResult([
          { fieldId: 'GAC01', metricName: 'name' },
          { fieldId: 'GAC02', metricName: 'spent' },
        ]),
      )
      callTool.mockResolvedValueOnce(
        textResult({
          rows: [
            ['Search Campaign X', '420.50', '20260907'],
            ['Display Campaign Y', '100.00', '20260907'],
          ],
        }),
      )

      const campaigns = await MetricoolProvider.getCampaigns!('222', 'googleAds')
      expect(campaigns).toEqual([
        { providerCampaignId: 'Search Campaign X', name: 'Search Campaign X', channel: 'googleAds' },
        { providerCampaignId: 'Display Campaign Y', name: 'Display Campaign Y', channel: 'googleAds' },
      ])
    })

    it('getCampaignPerformance maps spend/impressions/clicks/conversions per row and uses the row\'s own campaign name, never "unknown", when a name field is present', async () => {
      const callTool = mockCallTool()
      callTool.mockResolvedValueOnce(
        textResult([
          { fieldId: 'GAC01', metricName: 'name' },
          { fieldId: 'GAC02', metricName: 'spent' },
          { fieldId: 'GAC03', metricName: 'impressions' },
          { fieldId: 'GAC04', metricName: 'clicks' },
          { fieldId: 'GAC05', metricName: 'conversions' },
        ]),
      )
      callTool.mockResolvedValueOnce(
        textResult({
          rows: [['Search Campaign X', '420.50', '12000', '340', '34', '20260907']],
        }),
      )

      const perf = await MetricoolProvider.getCampaignPerformance!('222', 'googleAds', {
        from: '2026-08-01',
        to: '2026-09-07',
      })

      expect(perf).toHaveLength(1)
      expect(perf[0]).toMatchObject({
        providerCampaignId: 'Search Campaign X',
        spend: 420.5,
        impressions: 12000,
        clicks: 340,
        conversions: 34,
        period: '2026-09-07',
      })
    })
  })
})
