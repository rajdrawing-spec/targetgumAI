import type { AdCampaignPerformance, AnalyticsReportRow, SeoQueryRow, SocialMetricValue } from '@/lib/integrations/providers'

/**
 * Turns one analysis run's raw provider data (already gathered by an agent
 * - src/lib/agents/analytics-agent.ts, src/lib/agents/seo-agent.ts) into
 * the canonical, validated per-metric shape BRD-PRD Section 69 requires
 * ("Every metric should have: source, retrieved_at, period, value, unit")
 * - the "Validated calculations" step in Section 68's reporting
 * architecture diagram, sitting between raw provider data and Claude's
 * interpretation. `src/lib/analytics/snapshots.ts` persists these as
 * `AnalyticsSnapshot` rows and computes period-over-period trends from
 * them.
 *
 * Metric names are prefixed by source (`metricool.reach`, `ga4.sessions`,
 * `gsc.clicks`, `ads.spend`, ...) so the same metric name from two
 * providers never collides in a trend comparison.
 *
 * Aggregation rule per metric shape - deliberately not "sum everything":
 * - Event/count metrics (reach, impressions, clicks, conversions, spend,
 *   revenue, sessions, ...) are summed across the period's rows - each row
 *   is a slice of the same period, so totals add up correctly.
 * - Rate metrics (CTR, CPC, CPA, ROAS, position) are never averaged
 *   directly (averaging pre-computed per-row rates is a classic Simpson's-
 *   paradox mistake when row sizes differ) - they're *recomputed* from the
 *   already-summed base metrics (e.g. `ctr = clicks / impressions`), or,
 *   for GSC's position, an impression-weighted average.
 * - `followers` is a gauge (point-in-time count), never summed across
 *   rows - takes the max observed value in the period as a reasonable
 *   "current level" proxy in the absence of per-day ordering guarantees.
 */

export interface MetricSnapshotInput {
  metricName: string
  value: number
  unit?: string
  source: string
  retrievedAt: string
  period: string
}

/**
 * For a field that's optional per-row in the source type (a provider can
 * genuinely omit it). undefined (not 0) when every row is missing it - a
 * metric absent from every row is "not reported", never fabricated as
 * "reported as zero".
 */
function sumOptional(values: Array<number | undefined>): number | undefined {
  const present = values.filter((v): v is number => v != null)
  return present.length > 0 ? present.reduce((total, v) => total + v, 0) : undefined
}

/** For a field that's required per-row in the source type - a plain sum, no optionality to lose. */
function sumRequired(values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

function safeDivide(numerator: number, denominator: number): number | undefined {
  return denominator > 0 ? numerator / denominator : undefined
}

/** Same as safeDivide, but propagates "missing" through - a rate derived from a metric that was itself never reported is also never reported, not zero. */
function safeDivideOptional(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (numerator == null || denominator == null) return undefined
  return safeDivide(numerator, denominator)
}

function provenanceOf(rows: Array<{ source: string; retrievedAt: string; period: string }>) {
  return rows[0] ?? { source: 'unknown', retrievedAt: new Date().toISOString(), period: '' }
}

export function aggregateSocialMetrics(values: SocialMetricValue[]): MetricSnapshotInput[] {
  if (values.length === 0) return []
  const { source, retrievedAt, period } = provenanceOf(values)
  const base = { source, retrievedAt, period }

  const totals: Array<[string, number | undefined, string | undefined]> = [
    ['metricool.reach', sumOptional(values.map((v) => v.reach)), 'count'],
    ['metricool.impressions', sumOptional(values.map((v) => v.impressions)), 'count'],
    ['metricool.engagement', sumOptional(values.map((v) => v.engagement)), 'count'],
    ['metricool.likes', sumOptional(values.map((v) => v.likes)), 'count'],
    ['metricool.comments', sumOptional(values.map((v) => v.comments)), 'count'],
    ['metricool.shares', sumOptional(values.map((v) => v.shares)), 'count'],
    ['metricool.saves', sumOptional(values.map((v) => v.saves)), 'count'],
    ['metricool.clicks', sumOptional(values.map((v) => v.clicks)), 'count'],
    ['metricool.video_views', sumOptional(values.map((v) => v.videoViews)), 'count'],
    ['metricool.watch_time_seconds', sumOptional(values.map((v) => v.watchTimeSeconds)), 'seconds'],
    // followers: gauge, not additive - max observed value in the period.
    ['metricool.followers', values.reduce<number | undefined>((max, v) => (v.followers == null ? max : Math.max(max ?? 0, v.followers)), undefined), 'count'],
  ]

  return totals
    .filter((row): row is [string, number, string | undefined] => row[1] != null)
    .map(([metricName, value, unit]) => ({ ...base, metricName, value, unit }))
}

export function aggregateAdPerformance(values: AdCampaignPerformance[]): MetricSnapshotInput[] {
  if (values.length === 0) return []
  const { source, retrievedAt, period } = provenanceOf(values)
  const base = { source, retrievedAt, period }

  const spend = sumOptional(values.map((v) => v.spend))
  const impressions = sumOptional(values.map((v) => v.impressions))
  const clicks = sumOptional(values.map((v) => v.clicks))
  const conversions = sumOptional(values.map((v) => v.conversions))
  const revenue = sumOptional(values.map((v) => v.revenue))

  const rows: Array<[string, number | undefined, string | undefined]> = [
    ['ads.spend', spend, 'currency'],
    ['ads.impressions', impressions, 'count'],
    ['ads.clicks', clicks, 'count'],
    ['ads.conversions', conversions, 'count'],
    ['ads.revenue', revenue, 'currency'],
    ['ads.ctr', safeDivideOptional(clicks, impressions), 'ratio'],
    ['ads.cpc', safeDivideOptional(spend, clicks), 'currency'],
    ['ads.cpa', safeDivideOptional(spend, conversions), 'currency'],
    ['ads.roas', safeDivideOptional(revenue, spend), 'ratio'],
  ]

  return rows
    .filter((row): row is [string, number, string | undefined] => row[1] != null)
    .map(([metricName, value, unit]) => ({ ...base, metricName, value, unit }))
}

export function aggregateGa4Report(rows: AnalyticsReportRow[]): MetricSnapshotInput[] {
  if (rows.length === 0) return []
  const { source, retrievedAt, period } = provenanceOf(rows)
  const base = { source, retrievedAt, period }

  const metricNames = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row.metrics)) metricNames.add(key)
  }

  return Array.from(metricNames)
    .map((name) => ({
      name,
      value: sumOptional(rows.map((row) => row.metrics[name])),
    }))
    .filter((entry): entry is { name: string; value: number } => entry.value != null)
    .map(({ name, value }) => ({
      ...base,
      metricName: `ga4.${name}`,
      value,
      unit: name.toLowerCase().includes('revenue') ? 'currency' : 'count',
    }))
}

export function aggregateGscRows(rows: SeoQueryRow[]): MetricSnapshotInput[] {
  if (rows.length === 0) return []
  const { source, retrievedAt, period } = provenanceOf(rows)
  const base = { source, retrievedAt, period }

  // clicks/impressions are required per-row in SeoQueryRow - a plain sum,
  // guaranteed a real number for any non-empty rows array.
  const clicks = sumRequired(rows.map((r) => r.clicks))
  const impressions = sumRequired(rows.map((r) => r.impressions))
  // Impression-weighted average position - a query with more impressions
  // should move the average more than one with almost none.
  const weightedPositionTotal = rows.reduce((total, r) => total + r.position * r.impressions, 0)
  const avgPosition = safeDivide(weightedPositionTotal, impressions)

  const values: Array<[string, number | undefined, string | undefined]> = [
    ['gsc.clicks', clicks, 'count'],
    ['gsc.impressions', impressions, 'count'],
    ['gsc.ctr', safeDivide(clicks, impressions), 'ratio'],
    ['gsc.avg_position', avgPosition, 'position'],
  ]

  return values
    .filter((row): row is [string, number, string | undefined] => row[1] != null)
    .map(([metricName, value, unit]) => ({ ...base, metricName, value, unit }))
}
