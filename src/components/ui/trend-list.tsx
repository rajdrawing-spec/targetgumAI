import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { MetricTrend } from '@/lib/analytics/snapshots'

/**
 * Renders period-over-period metric trends (BRD Section 41's "Results").
 * Deliberately neutral on "good" vs "bad": whether a rising number is
 * positive depends on the metric (rising clicks is good, rising CPA or
 * average position is not) - rather than guess a polarity per metric name,
 * this shows the plain direction and magnitude and lets the reader, who
 * knows what the metric means, judge it. Never colors a change green/red
 * as if direction alone answered that.
 */

function formatValue(value: number, unit?: string): string {
  switch (unit) {
    case 'currency':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    case 'ratio':
      return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    case 'position':
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
    case 'seconds':
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}s`
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
}

/** "gsc.avg_position" -> "Gsc avg position" -> good enough without a full per-source label map. */
function formatMetricName(metricName: string): string {
  const label = metricName.replace(/^[a-z0-9]+\./, '').replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function TrendList({ trends }: { trends: MetricTrend[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {trends.map((trend) => (
        <li key={trend.metricName} className="rounded-md border border-border p-3">
          <p className="text-xs text-caption">{formatMetricName(trend.metricName)}</p>
          <p className="mt-0.5 text-xl font-medium tabular-nums text-foreground">
            {formatValue(trend.currentValue, trend.unit)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            {trend.changePercent == null ? (
              <span>No prior period to compare</span>
            ) : (
              <>
                {trend.changePercent > 0 && <ArrowUp className="h-3 w-3 text-dustyBlue" />}
                {trend.changePercent < 0 && <ArrowDown className="h-3 w-3 text-dustyBlue" />}
                {trend.changePercent === 0 && <Minus className="h-3 w-3 text-caption" />}
                <span>
                  {trend.changePercent > 0 ? '+' : ''}
                  {trend.changePercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% vs prior period
                </span>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}
