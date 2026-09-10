import type { SEOProvider, SeoQueryRow } from '../providers'

/** Full mock implementation (BRD Section 92) - deterministic, no network, no OAuth needed. */
export const GSCMockProvider: SEOProvider = {
  async getSearchPerformance(request): Promise<SeoQueryRow[]> {
    const now = new Date().toISOString()
    return [
      {
        source: 'gsc-mock',
        retrievedAt: now,
        period: `${request.range.from}..${request.range.to}`,
        keys: Object.fromEntries(request.dimensions.map((d) => [d, `mock-${d}`])),
        clicks: 120,
        impressions: 4300,
        ctr: 0.0279,
        position: 8.4,
        raw: { mock: true },
      },
    ]
  },
}
