import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { acceptRecommendationAction, rejectRecommendationAction } from '../actions'

export default async function RecommendationsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const recommendations = await listRecommendationsForOrg(ctx, { limit: 100 })
  const canDecide = ctx.permissions.has('approvals.request')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Recommendations</h1>
      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-400">No recommendations yet.</p>
      ) : (
        <ul className="space-y-3">
          {recommendations.map((rec) => (
            <li key={rec.id} className="rounded border border-gray-200 p-4 text-sm">
              <div className="flex items-center justify-between">
                <Link href={`/dashboard/clients/${rec.clientId}`} className="font-medium hover:underline">
                  {rec.client?.name ?? rec.clientId}
                </Link>
                <span className="text-xs text-gray-500">
                  [{rec.priority}] {rec.area} · {rec.status}
                </span>
              </div>
              <p className="mt-2 text-gray-700">{rec.finding}</p>
              <p className="mt-1 text-gray-500">→ {rec.recommendation}</p>

              {canDecide && rec.status === 'RECOMMENDED' && (
                <div className="mt-3 flex gap-2">
                  <form action={acceptRecommendationAction.bind(null, rec.id, rec.clientId)}>
                    <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                      Accept
                    </button>
                  </form>
                  <form action={rejectRecommendationAction.bind(null, rec.id, rec.clientId, 'Rejected from dashboard.')}>
                    <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
