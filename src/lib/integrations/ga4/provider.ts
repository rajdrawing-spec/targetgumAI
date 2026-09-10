import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import type { AnalyticsProvider } from '../providers'

/**
 * The real GA4 adapter. Wraps the GA4 Data API's `runReport` (Google's
 * stable, official `googleapis` client library - not guessed) behind
 * TargetGum's vendor-neutral AnalyticsProvider interface.
 *
 * NOT LIVE-VERIFIED: no real Google Cloud OAuth app / GA4 property is
 * configured in any environment this code has run in - see
 * docs/EXTERNAL-APPROVALS.md.
 *
 * Unlike Metricool (one org-wide API key), GA4 needs a per-client OAuth2
 * client built from that client's own stored refresh token - see
 * src/lib/integrations/ga4/index.ts for how `auth` here gets resolved per
 * call.
 */
export function createGA4Provider(auth: OAuth2Client): AnalyticsProvider {
  return {
    async getReport(request) {
      const analyticsdata = google.analyticsdata({ version: 'v1beta', auth })
      const res = await analyticsdata.properties.runReport({
        property: `properties/${request.propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: request.range.from, endDate: request.range.to }],
          dimensions: request.dimensions.map((name) => ({ name })),
          metrics: request.metrics.map((name) => ({ name })),
        },
      })

      const dimensionNames = (res.data.dimensionHeaders ?? []).map((h) => h.name ?? '')
      const metricNames = (res.data.metricHeaders ?? []).map((h) => h.name ?? '')
      const now = new Date().toISOString()
      const period = `${request.range.from}..${request.range.to}`

      return (res.data.rows ?? []).map((row) => {
        const dimensions: Record<string, string> = {}
        ;(row.dimensionValues ?? []).forEach((value, i) => {
          dimensions[dimensionNames[i] || `dimension${i}`] = value.value ?? ''
        })

        const metrics: Record<string, number> = {}
        ;(row.metricValues ?? []).forEach((value, i) => {
          metrics[metricNames[i] || `metric${i}`] = Number(value.value ?? 0)
        })

        return { source: 'ga4', retrievedAt: now, period, dimensions, metrics, raw: row }
      })
    },
  }
}
