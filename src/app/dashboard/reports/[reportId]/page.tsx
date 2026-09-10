import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, FileText, Lightbulb, AlertTriangle, Copy } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getReport } from '@/lib/reports/generate'
import type { ReportContent } from '@/lib/reports/generate'
import { generateClientReportAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, StatusBadge, toSentenceCase } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const report = await getReport(ctx, reportId)
  const content = report.content as unknown as ReportContent

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/reports" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Reports
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">{report.title}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge variant="neutral">{toSentenceCase(report.type)}</Badge>
              <span className="text-sm text-muted-foreground">
                {content.periodStart} – {content.periodEnd}
              </span>
            </div>
          </div>
          {report.type === 'INTERNAL' && (
            <form action={generateClientReportAction.bind(null, report.id)}>
              <Button type="submit" variant="outline" size="sm">
                <Copy className="h-3.5 w-3.5" /> Generate client report
              </Button>
            </form>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{content.summary}</p>
        </CardContent>
      </Card>

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
                    {finding.confidence != null && (
                      <span className="text-xs text-caption">Confidence: {finding.confidence}</span>
                    )}
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
    </div>
  )
}
