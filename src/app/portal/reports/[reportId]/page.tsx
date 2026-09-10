import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, FileText, Lightbulb, TrendingUp } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getReport } from '@/lib/reports/generate'
import type { ReportContent } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TrendList } from '@/components/ui/trend-list'

/**
 * `getReport` already refuses an INTERNAL report to a client_user
 * (`src/lib/reports/generate.ts`) - this view only ever renders the
 * CLIENT-redacted shape (no evidence/confidence/dataGaps fields exist on
 * it at all, so there's nothing here that could leak them even by
 * omission-bug).
 */
export default async function PortalReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  let report
  try {
    report = await getReport(ctx, reportId)
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }
  const content = report.content as unknown as ReportContent

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/portal/clients/${report.clientId}`} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-foreground">{report.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {content.periodStart} – {content.periodEnd}
        </p>
      </div>

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
                  <div className="flex items-center gap-2">
                    <StatusBadge status={finding.priority} />
                    <span className="text-sm font-medium text-foreground">{finding.area}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{finding.finding}</p>
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
                  {rec.expectedImpact && <p className="mt-1 text-xs text-muted-foreground">Expected impact: {rec.expectedImpact}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
