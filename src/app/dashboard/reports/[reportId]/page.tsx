import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getReport } from '@/lib/reports/generate'
import type { ReportContent } from '@/lib/reports/generate'
import { generateClientReportAction } from '../../actions'

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const report = await getReport(ctx, reportId)
  const content = report.content as unknown as ReportContent

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/reports" className="text-xs text-gray-500 hover:underline">
          ← Reports
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{report.title}</h1>
          {report.type === 'INTERNAL' && (
            <form action={generateClientReportAction.bind(null, report.id)}>
              <button type="submit" className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">
                Generate client report
              </button>
            </form>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {report.type} · {content.periodStart} – {content.periodEnd}
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
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    [{finding.priority}] {finding.area}
                  </span>
                  {finding.confidence != null && (
                    <span className="text-xs text-gray-500">confidence: {finding.confidence}</span>
                  )}
                </div>
                <p className="mt-1 text-gray-700">{finding.finding}</p>
                {finding.evidence && finding.evidence.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs text-gray-500">
                    {finding.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                )}
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

      {content.dataGaps && content.dataGaps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700">Data gaps</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-gray-500">
            {content.dataGaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
