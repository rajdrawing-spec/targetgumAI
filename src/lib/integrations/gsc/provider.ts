import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import type { SEOProvider } from '../providers'

/**
 * The real GSC adapter. Wraps the Search Console API's `searchanalytics.query`
 * (Google's stable, official `googleapis` client library - not guessed)
 * behind TargetGum's vendor-neutral SEOProvider interface.
 *
 * NOT LIVE-VERIFIED: no real Google Cloud OAuth app / Search Console
 * property is configured in any environment this code has run in - see
 * docs/EXTERNAL-APPROVALS.md.
 */
export function createGSCProvider(auth: OAuth2Client): SEOProvider {
  return {
    async getSearchPerformance(request) {
      const searchconsole = google.searchconsole({ version: 'v1', auth })
      const res = await searchconsole.searchanalytics.query({
        siteUrl: request.siteUrl,
        requestBody: {
          startDate: request.range.from,
          endDate: request.range.to,
          dimensions: request.dimensions,
          rowLimit: request.rowLimit ?? 1000,
        },
      })

      const now = new Date().toISOString()
      const period = `${request.range.from}..${request.range.to}`

      return (res.data.rows ?? []).map((row) => {
        const keys: Record<string, string> = {}
        ;(row.keys ?? []).forEach((value, i) => {
          keys[request.dimensions[i] ?? `dimension${i}`] = value
        })
        return {
          source: 'gsc',
          retrievedAt: now,
          period,
          keys,
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
          raw: row,
        }
      })
    },
  }
}
