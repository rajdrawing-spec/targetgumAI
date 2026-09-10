import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { listRecommendations } from '@/lib/recommendations/persist'
import { listReports } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  portalAcceptRecommendationAction,
  portalRejectRecommendationAction,
  submitFeedbackAction,
} from '../../actions'

/**
 * The Client Portal's main view for one client (BRD Section 4.4): review
 * and accept/reject recommendations, see CLIENT-facing reports
 * (`listReports` already redacts to CLIENT-type only for a client_user -
 * `src/lib/reports/generate.ts`), and leave feedback. No tasks, no
 * Approval-Engine approvals, no AI runs, no integration detail - none of
 * that is a client capability per Section 4.4.
 */
export default async function PortalClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  let client
  try {
    client = await getAuthorizedClient(ctx, clientId)
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }

  const [recommendations, reports] = await Promise.all([
    listRecommendations(ctx, clientId),
    listReports(ctx, clientId),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">{client.name}</h1>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Recommendations</h2>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Nothing to review right now.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {recommendations.map((rec) => (
              <li key={rec.id} className="rounded border border-gray-200 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    [{rec.priority}] {rec.area}
                  </span>
                  <span className="text-xs text-gray-500">{rec.status}</span>
                </div>
                <p className="mt-1 text-gray-700">{rec.finding}</p>
                <p className="mt-1 text-gray-500">→ {rec.recommendation}</p>

                {rec.status === 'RECOMMENDED' && (
                  <div className="mt-3 flex gap-2">
                    <form action={portalAcceptRecommendationAction.bind(null, rec.id, clientId)}>
                      <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800">
                        Approve
                      </button>
                    </form>
                    <form action={portalRejectRecommendationAction.bind(null, rec.id, clientId, 'Rejected from client portal.')}>
                      <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                        Decline
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Reports</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No reports yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {reports.map((report) => (
              <li key={report.id}>
                <Link href={`/portal/reports/${report.id}`} className="hover:underline">
                  {report.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Feedback</h2>
        <form action={submitFeedbackAction.bind(null, clientId)} className="mt-2 space-y-2">
          <textarea
            name="content"
            required
            rows={3}
            placeholder="Anything you'd like your team to know..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            Send feedback
          </button>
        </form>
      </section>
    </div>
  )
}
