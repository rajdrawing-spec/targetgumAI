import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAiRuns } from '@/lib/ai/runs'
import { listAccessibleClients } from '@/lib/clients/list'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { listApprovals } from '@/lib/approvals/approvals'

/**
 * Dashboard Overview (BRD-PRD Section 42's home dashboard): active clients,
 * pending approvals, high-priority recommendations, recent AI runs,
 * integration health, tasks due. "Scheduled content" and "campaign alerts"
 * (also listed in Section 42) have no backing module yet in the MVP -
 * omitted here rather than shown empty/fake.
 */
export default async function DashboardOverviewPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const [clients, pendingApprovals, highPriorityRecs, recentAiRuns, connections, openTasks] = await Promise.all([
    listAccessibleClients(ctx),
    listApprovals(ctx, { status: 'PENDING' }),
    listRecommendationsForOrg(ctx, { status: 'RECOMMENDED', priority: 'HIGH', limit: 5 }),
    listAiRuns(ctx, { limit: 5 }),
    listIntegrationConnectionsForOrg(ctx),
    listTasksForOrg(ctx, { status: 'OPEN', limit: 5 }),
  ])

  const connectionsByStatus = connections.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active clients" value={clients.length} href="/dashboard/clients" />
        <StatCard label="Pending approvals" value={pendingApprovals.length} href="/dashboard/approvals" />
        <StatCard label="High-priority recommendations" value={highPriorityRecs.length} href="/dashboard/recommendations" />
        <StatCard label="Open tasks" value={openTasks.length} href="/dashboard/tasks" />
      </div>

      <section>
        <Link href="/dashboard/integrations" className="text-sm font-semibold text-gray-700 hover:underline">
          Integration health
        </Link>
        {connections.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No integrations connected yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {Object.entries(connectionsByStatus).map(([status, count]) => (
              <span
                key={status}
                className={`rounded px-2 py-1 ${status === 'CONNECTED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
              >
                {status}: {count}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Recent AI runs</h2>
        {recentAiRuns.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No AI runs yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="pb-2 font-medium">Client</th>
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Cost</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentAiRuns.map((run) => (
                <tr key={run.id}>
                  <td className="py-2">{run.client?.name ?? '—'}</td>
                  <td className="py-2">{run.model}</td>
                  <td className="py-2">{run.status}</td>
                  <td className="py-2">
                    {run.estimatedCostCents != null ? `$${(run.estimatedCostCents / 100).toFixed(3)}` : '—'}
                  </td>
                  <td className="py-2 text-gray-500">{run.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">High-priority recommendations</h2>
        {highPriorityRecs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Nothing needs attention right now.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {highPriorityRecs.map((rec) => (
              <li key={rec.id}>
                <Link href={`/dashboard/clients/${rec.clientId}`} className="text-gray-900 hover:underline">
                  {rec.client?.name ?? rec.clientId}
                </Link>
                <span className="text-gray-500"> — {rec.finding}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block rounded border border-gray-200 p-4 hover:border-gray-300">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </Link>
  )
}
