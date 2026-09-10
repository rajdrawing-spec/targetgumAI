import { db } from '@/lib/db/client'
import type { MetricSnapshotInput } from './metrics'

/**
 * Persists the validated per-metric values a report run produced
 * (`./metrics.ts`) as durable `AnalyticsSnapshot` rows, and compares each
 * one against the most recent prior snapshot for the same client+metric to
 * produce a period-over-period trend - the "Results" piece of BRD-PRD
 * Section 41's client report structure, computed from real stored numbers
 * rather than asked of Claude (Section 68: "Avoid asking Claude to invent
 * metrics").
 *
 * Internal to the reporting pipeline (called only from
 * `src/lib/reports/generate.ts`, itself already permission/tenant-checked
 * before this runs) - not its own permission-gated entry point, same trust
 * boundary as `generateReport`'s other private helpers.
 */

export interface MetricTrend {
  metricName: string
  unit?: string
  currentValue: number
  previousValue: number | null
  /** null when there's no prior snapshot to compare against, or the prior value was exactly 0 (a percent change from zero is undefined, not infinite). */
  changePercent: number | null
}

/**
 * Looks up the most recent prior snapshot for each metric, computes the
 * trend, THEN writes the new snapshot rows - order matters so a metric
 * never gets compared against the value it's about to become.
 */
export async function persistAndCompareMetrics(
  organizationId: string,
  clientId: string,
  metrics: MetricSnapshotInput[],
  asOfDate: Date,
): Promise<MetricTrend[]> {
  if (metrics.length === 0) return []

  const trends: MetricTrend[] = []
  for (const metric of metrics) {
    const previous = await db.analyticsSnapshot.findFirst({
      where: { clientId, metricName: metric.metricName, date: { lt: asOfDate } },
      orderBy: { date: 'desc' },
    })
    const previousValue = previous ? previous.value.toNumber() : null
    const changePercent = previousValue != null && previousValue !== 0
      ? ((metric.value - previousValue) / Math.abs(previousValue)) * 100
      : null

    trends.push({ metricName: metric.metricName, unit: metric.unit, currentValue: metric.value, previousValue, changePercent })
  }

  await db.analyticsSnapshot.createMany({
    data: metrics.map((metric) => ({
      organizationId,
      clientId,
      date: asOfDate,
      source: metric.source,
      retrievedAt: new Date(metric.retrievedAt),
      period: metric.period,
      metricName: metric.metricName,
      value: metric.value,
      unit: metric.unit,
    })),
  })

  return trends
}
