import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, FileText, Lightbulb, AlertTriangle, Copy, TrendingUp } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getReport } from '@/lib/reports/generate'
import type { ReportContent } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'
import { generateClientReportAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, StatusBadge, toSentenceCase } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TrendList } from '@/components/ui/trend-list'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'

/** Runtime guard for the stored JSON - a malformed row renders an explanation, not a crash. */
function isReportContent(value: unknown): value is ReportContent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.summary === 'string' && Array.isArray(v.findings) && Array.isArray(v.recommendations)
}

interface AdReportContent {
  executiveSummary: string
  metrics: { impressions: number; clicks: number; spend: number; revenue: number; ctr: number; cpc: number; roas: number; amazonAcos: number }
  channelBreakdown: Array<{ platform: string; impressions: number; spend: number; roas: number; clicks: number }>
  diagnostics: Array<{ title: string; whatIsHappening: string; impact: string; recommendation: string; severity: string }>
  generatedAt: string
}

/**
 * The "AI Ad Performance & Impression Audit" shape
 * (`src/lib/ads/analyzer.ts`'s `createAndShareClientReport`) - a genuinely
 * different report type from `ReportContent` above (a per-channel
 * breakdown, severity-graded diagnostics with an impact estimate and
 * suggested action), not a variant of it - so it gets its own rendering
 * below rather than being force-fit into the generic Findings/
 * Recommendations shape, which would silently drop channelBreakdown and
 * severity. Already rendered correctly in the client portal
 * (`src/app/portal/reports/[reportId]/page.tsx`) - this brings the staff
 * dashboard view to parity; before this fix, every report created this way
 * hit the "unexpected format" fallback below, every time (see
 * docs/DECISIONS.md).
 */
function isAdReportContent(value: unknown): value is AdReportContent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.executiveSummary === 'string' && typeof v.metrics === 'object' && v.metrics !== null && Array.isArray(v.diagnostics)
}

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const [{ reportId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  let report
  try {
    report = await getReport(ctx, reportId)
  } catch (error) {
    // Same as the portal twin: a bad or unauthorized id is a 404, never a
    // crash card, and never a hint that the report exists.
    if (error instanceof ForbiddenError) notFound()
    throw error
  }
  const content = report.content

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/reports" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Reports
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">{report.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{toSentenceCase(report.type)}</Badge>
              <Link href={`/dashboard/clients/${report.clientId}`} className="text-sm text-muted-foreground hover:text-primary">
                {report.client.name}
              </Link>
              <span className="text-sm tabular-nums text-muted-foreground">
                {report.periodStart.toISOString().slice(0, 10)} – {report.periodEnd.toISOString().slice(0, 10)}
              </span>
            </div>
          </div>
          {report.type === 'INTERNAL' && (
            <ActionForm action={generateClientReportAction.bind(null, report.id)}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Generating…">
                <Copy className="h-3.5 w-3.5" /> Generate client report
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {isAdReportContent(content) ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Executive summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{content.executiveSummary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Ad impressions', value: content.metrics.impressions.toLocaleString() },
              { label: 'Clicks (CTR)', value: `${content.metrics.clicks.toLocaleString()} (${content.metrics.ctr}%)` },
              { label: 'Total spend', value: `$${content.metrics.spend.toLocaleString()}` },
              { label: 'Return on ad spend', value: `${content.metrics.roas}x ROAS`, accent: true },
            ].map((tile) => (
              <div key={tile.label} className="rounded-md border border-border bg-card p-3.5">
                <span className="block text-xs font-medium uppercase tracking-wide text-caption">{tile.label}</span>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${tile.accent ? 'text-success' : 'text-foreground'}`}>{tile.value}</p>
              </div>
            ))}
          </div>

          {content.channelBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel performance breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {content.channelBreakdown.map((ch) => (
                    <div key={ch.platform} className="rounded-md border border-border p-3 text-xs">
                      <p className="font-semibold text-foreground">{ch.platform}</p>
                      <p className="mt-1 text-caption">
                        {ch.impressions.toLocaleString()} impressions · ${ch.spend.toLocaleString()} spend
                      </p>
                      <p className="mt-1 font-semibold text-success">{ch.roas}x ROAS</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-muted-foreground" /> AI diagnostic findings & strategic actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content.diagnostics.length === 0 ? (
                <EmptyState icon={Lightbulb} title="No diagnostics" />
              ) : (
                <ul className="space-y-3">
                  {content.diagnostics.map((diag, i) => (
                    <li key={i} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={diag.severity} />
                          <span className="text-sm font-medium text-foreground">{diag.title}</span>
                        </div>
                        {diag.impact && <span className="text-xs font-semibold text-success">{diag.impact}</span>}
                      </div>
                      <p className="mt-1.5 text-sm text-caption">{diag.whatIsHappening}</p>
                      <p className="mt-2 border-t border-border pt-2 text-sm font-medium text-foreground">{diag.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : !isReportContent(content) ? (
        <Card className="border-warning/30 bg-warning-bg/40">
          <CardContent className="p-4 text-sm text-foreground">
            This report&apos;s stored content is in an unexpected format and can&apos;t be displayed. Re-run the analysis to generate a fresh report.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{content.summary}</p>
            </CardContent>
          </Card>

          {content.trends && content.trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" /> Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendList trends={content.trends} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" /> Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content.findings.length === 0 ? (
                <EmptyState icon={FileText} title="No findings" />
              ) : (
                <ul className="space-y-3">
                  {content.findings.map((finding, i) => (
                    <li key={i} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={finding.priority} />
                          <span className="text-sm font-medium text-foreground">{finding.area}</span>
                        </div>
                        {finding.confidence != null && <span className="text-xs text-caption">Confidence: {finding.confidence}</span>}
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{finding.finding}</p>
                      {finding.evidence && finding.evidence.length > 0 && (
                        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-caption">
                          {finding.evidence.map((e, j) => (
                            <li key={j}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-muted-foreground" /> Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content.recommendations.length === 0 ? (
                <EmptyState icon={Lightbulb} title="No recommendations" />
              ) : (
                <ul className="space-y-3">
                  {content.recommendations.map((rec, i) => (
                    <li key={i} className="rounded-md border border-border p-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={rec.priority} />
                        <span className="text-sm font-medium text-foreground">{rec.area}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{rec.recommendation}</p>
                      {rec.expectedImpact && <p className="mt-1 text-xs text-caption">Expected impact: {rec.expectedImpact}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {content.dataGaps && content.dataGaps.length > 0 && (
            <Card className="border-warning/30 bg-warning-bg/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-warning">
                  <AlertTriangle className="h-4 w-4" /> Data gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                  {content.dataGaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
