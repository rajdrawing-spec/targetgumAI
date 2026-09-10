import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getReport } from '@/lib/reports/generate'
import type { ReportContent } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'

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
        <Link href={`/portal/clients/${report.clientId}`} className="text-xs text-gray-500 hover:underline">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">{report.title}</h1>
        <p className="text-sm text-gray-500">
          {content.periodStart} – {content.periodEnd}
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Summary</h2>
        <p className="mt-1 text-sm text-gray-700">{content.summary}</p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Findings</h2>
        {content.findings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No findings.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {content.findings.map((finding, i) => (
              <li key={i} className="rounded border border-gray-200 p-3">
                <span className="font-medium">
                  [{finding.priority}] {finding.area}
                </span>
                <p className="mt-1 text-gray-700">{finding.finding}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Recommendations</h2>
        {content.recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No recommendations.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {content.recommendations.map((rec, i) => (
              <li key={i} className="rounded border border-gray-200 p-3">
                <span className="font-medium">
                  [{rec.priority}] {rec.area}
                </span>
                <p className="mt-1 text-gray-700">{rec.recommendation}</p>
                {rec.expectedImpact && <p className="mt-1 text-xs text-gray-500">Expected impact: {rec.expectedImpact}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
