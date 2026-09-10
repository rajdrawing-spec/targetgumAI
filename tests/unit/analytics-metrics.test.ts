import { describe, expect, it } from 'vitest'
import { aggregateAdPerformance, aggregateGa4Report, aggregateGscRows, aggregateSocialMetrics } from '@/lib/analytics/metrics'
import type { AdCampaignPerformance, AnalyticsReportRow, SeoQueryRow, SocialMetricValue } from '@/lib/integrations/providers'

/**
 * The "validated calculations" step (BRD Section 68/69) - correctness
 * matters here specifically because these numbers are what a client sees
 * as "Results" (Section 41), not an AI-narrated approximation. Covers the
 * three aggregation rules documented in src/lib/analytics/metrics.ts: sum
 * for event/count metrics, recompute-from-sums (never average) for rate
 * metrics, and max (not sum) for the one gauge metric (followers).
 */
describe('src/lib/analytics/metrics.ts - validated metric aggregation', () => {
  const PROVENANCE = { source: 'metricool', retrievedAt: '2026-04-01T00:00:00Z', period: '2026-04-01..2026-04-30' }

  it('aggregateSocialMetrics sums event counts but takes the MAX (not sum) of followers, since followers is a gauge not a per-row count', () => {
    const values: SocialMetricValue[] = [
      { ...PROVENANCE, reach: 100, impressions: 200, likes: 10, followers: 500, raw: {} },
      { ...PROVENANCE, reach: 150, impressions: 300, likes: 20, followers: 520, raw: {} },
    ]
    const metrics = aggregateSocialMetrics(values)
    const byName = Object.fromEntries(metrics.map((m) => [m.metricName, m.value]))

    expect(byName['metricool.reach']).toBe(250) // 100 + 150
    expect(byName['metricool.impressions']).toBe(500) // 200 + 300
    expect(byName['metricool.likes']).toBe(30) // 10 + 20
    expect(byName['metricool.followers']).toBe(520) // max, not 500 + 520
  })

  it('aggregateSocialMetrics omits a metric entirely when every row is missing it (never fabricates a zero)', () => {
    const values: SocialMetricValue[] = [{ ...PROVENANCE, reach: 100, raw: {} }]
    const metrics = aggregateSocialMetrics(values)
    expect(metrics.some((m) => m.metricName === 'metricool.likes')).toBe(false)
  })

  it('aggregateAdPerformance recomputes CTR/CPC/CPA/ROAS from summed totals rather than averaging per-row rates', () => {
    const values: AdCampaignPerformance[] = [
      { ...PROVENANCE, source: 'metricool', providerCampaignId: 'a', spend: 100, impressions: 1000, clicks: 50, conversions: 5, revenue: 200, raw: {} },
      { ...PROVENANCE, source: 'metricool', providerCampaignId: 'b', spend: 300, impressions: 9000, clicks: 50, conversions: 5, revenue: 400, raw: {} },
    ]
    const metrics = aggregateAdPerformance(values)
    const byName = Object.fromEntries(metrics.map((m) => [m.metricName, m.value]))

    // Totals: spend=400, impressions=10000, clicks=100, conversions=10, revenue=600
    expect(byName['ads.spend']).toBe(400)
    expect(byName['ads.impressions']).toBe(10000)
    expect(byName['ads.clicks']).toBe(100)
    // ctr = 100/10000 = 0.01 - NOT a simple average of each row's own CTR
    // (row a: 50/1000=0.05, row b: 50/9000≈0.0056 - averaging those would give ≈0.028, wrong)
    expect(byName['ads.ctr']).toBeCloseTo(0.01, 5)
    expect(byName['ads.cpc']).toBeCloseTo(4, 5) // 400/100
    expect(byName['ads.cpa']).toBeCloseTo(40, 5) // 400/10
    expect(byName['ads.roas']).toBeCloseTo(1.5, 5) // 600/400
  })

  it('aggregateAdPerformance omits a rate metric rather than dividing by zero when its denominator is zero', () => {
    const values: AdCampaignPerformance[] = [{ ...PROVENANCE, source: 'metricool', providerCampaignId: 'a', spend: 100, impressions: 0, clicks: 0, raw: {} }]
    const metrics = aggregateAdPerformance(values)
    expect(metrics.some((m) => m.metricName === 'ads.ctr')).toBe(false)
    expect(metrics.some((m) => m.metricName === 'ads.cpc')).toBe(false)
  })

  it('aggregateGa4Report sums every metric key across rows, prefixed with ga4.', () => {
    const rows: AnalyticsReportRow[] = [
      { ...PROVENANCE, source: 'ga4', dimensions: { channel: 'Organic' }, metrics: { sessions: 100, conversions: 5, totalRevenue: 50 }, raw: {} },
      { ...PROVENANCE, source: 'ga4', dimensions: { channel: 'Paid' }, metrics: { sessions: 200, conversions: 10, totalRevenue: 150 }, raw: {} },
    ]
    const metrics = aggregateGa4Report(rows)
    const byName = Object.fromEntries(metrics.map((m) => [m.metricName, m.value]))
    expect(byName['ga4.sessions']).toBe(300)
    expect(byName['ga4.conversions']).toBe(15)
    expect(byName['ga4.totalRevenue']).toBe(200)
  })

  it('aggregateGscRows computes an impression-weighted average position, not a naive mean across queries', () => {
    const rows: SeoQueryRow[] = [
      { ...PROVENANCE, source: 'gsc', keys: { query: 'high volume' }, clicks: 80, impressions: 9000, ctr: 0.0089, position: 3, raw: {} },
      { ...PROVENANCE, source: 'gsc', keys: { query: 'low volume' }, clicks: 2, impressions: 1000, ctr: 0.002, position: 15, raw: {} },
    ]
    const metrics = aggregateGscRows(rows)
    const byName = Object.fromEntries(metrics.map((m) => [m.metricName, m.value]))

    expect(byName['gsc.clicks']).toBe(82)
    expect(byName['gsc.impressions']).toBe(10000)
    expect(byName['gsc.ctr']).toBeCloseTo(0.0082, 4) // 82/10000
    // Naive mean of [3, 15] is 9 - the weighted average should sit much
    // closer to 3, since the high-volume (9000 impressions) query dominates.
    const weighted = (3 * 9000 + 15 * 1000) / 10000
    expect(byName['gsc.avg_position']).toBeCloseTo(weighted, 5)
    expect(byName['gsc.avg_position']).toBeLessThan(9)
  })

  it('every aggregation function returns [] for empty input rather than throwing or fabricating zeros', () => {
    expect(aggregateSocialMetrics([])).toEqual([])
    expect(aggregateAdPerformance([])).toEqual([])
    expect(aggregateGa4Report([])).toEqual([])
    expect(aggregateGscRows([])).toEqual([])
  })
})
