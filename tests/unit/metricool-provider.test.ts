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
})
