import { describe, expect, it } from 'vitest'
import { GA4MockProvider } from '@/lib/integrations/ga4/mock-provider'
import { GSCMockProvider } from '@/lib/integrations/gsc/mock-provider'

const range = { from: '2026-01-01', to: '2026-01-31' }

describe('GA4MockProvider (BRD Section 92)', () => {
  it('returns rows with provenance and the requested dimensions/metrics keys', async () => {
    const rows = await GA4MockProvider.getReport({
      propertyId: '123456',
      dimensions: ['date', 'sessionDefaultChannelGroup'],
      metrics: ['sessions', 'conversions'],
      range,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.source).toBe('ga4-mock')
    expect(rows[0]?.period).toBe(`${range.from}..${range.to}`)
    expect(Object.keys(rows[0]!.dimensions)).toEqual(['date', 'sessionDefaultChannelGroup'])
    expect(Object.keys(rows[0]!.metrics)).toEqual(['sessions', 'conversions'])
  })
})

describe('GSCMockProvider (BRD Section 92)', () => {
  it('returns rows with provenance and normalized SEO fields', async () => {
    const rows = await GSCMockProvider.getSearchPerformance({
      siteUrl: 'https://example.com/',
      dimensions: ['query', 'page'],
      range,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.source).toBe('gsc-mock')
    expect(typeof rows[0]?.clicks).toBe('number')
    expect(typeof rows[0]?.position).toBe('number')
    expect(Object.keys(rows[0]!.keys)).toEqual(['query', 'page'])
  })
})
