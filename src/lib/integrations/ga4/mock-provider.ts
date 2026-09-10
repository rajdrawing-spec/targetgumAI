import type { AnalyticsProvider, AnalyticsReportRow } from '../providers'

/** Full mock implementation (BRD Section 92) - deterministic, no network, no OAuth needed. */
export const GA4MockProvider: AnalyticsProvider = {
  async getReport(request): Promise<AnalyticsReportRow[]> {
    const now = new Date().toISOString()
    return [
      {
        source: 'ga4-mock',
        retrievedAt: now,
        period: `${request.range.from}..${request.range.to}`,
        dimensions: Object.fromEntries(request.dimensions.map((d) => [d, `mock-${d}`])),
        metrics: Object.fromEntries(request.metrics.map((m) => [m, 1000])),
        raw: { mock: true },
      },
    ]
  },
}
