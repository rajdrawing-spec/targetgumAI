import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { listAiRuns } from '@/lib/ai/runs'
import { getClientPolicy } from '@/lib/clients/brain'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listRecommendations } from '@/lib/recommendations/persist'
import { listTasks } from '@/lib/recommendations/tasks'
import { listApprovals } from '@/lib/approvals/approvals'
import { listReports } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'
import { connectMetricoolBrandAction, triggerAnalyzeClientAction } from '../../actions'

/**
 * Client detail: the "Analyze Client A" trigger (BRD Section 46/43 - "the
 * user should be able to type 'Analyze Client A's marketing performance'"
 * -  a button is the MVP's non-natural-language stand-in, BRD Section 44's
 * command layer is Phase 2) plus that client's recommendations, tasks,
 * approvals, reports, and integration status.
 */
export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
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

  const [policy, recommendations, tasks, approvals, reports, allConnections, aiRuns] = await Promise.all([
    getClientPolicy(ctx, clientId),
    listRecommendations(ctx, clientId),
    listTasks(ctx, clientId),
    listApprovals(ctx, { clientId }),
    listReports(ctx, clientId),
    listIntegrationConnectionsForOrg(ctx),
    listAiRuns(ctx, { clientId, limit: 10 }),
  ])
  const connections = allConnections.filter((c) => c.clientId === clientId)
  const canManageIntegrations = ctx.permissions.has('integrations.manage')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/clients" className="text-xs text-gray-500 hover:underline">
            ← Clients
          </Link>
          <h1 className="text-xl font-semibold">{client.name}</h1>
          <p className="text-sm text-gray-500">
            {client.status} · automation: {client.automationLevel}
          </p>
        </div>
        <form action={triggerAnalyzeClientAction.bind(null, clientId)}>
          <button
            type="submit"
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Analyze this client
          </button>
        </form>
      </div>

      {policy && (
        <section className="rounded border border-gray-200 p-4 text-sm">
          <h2 className="font-semibold text-gray-700">Policy</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-gray-600 sm:grid-cols-4">
            <div>
              <dt className="text-gray-400">Max daily ad budget</dt>
              <dd>{policy.maxDailyAdBudget?.toString() ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Auto-publish social</dt>
              <dd>{policy.autoPublishSocial ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Auto-change ads</dt>
              <dd>{policy.autoChangeAds ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Approval for launches</dt>
              <dd>{policy.requireApprovalForCampaignLaunch ? 'Required' : 'Not required'}</dd>
            </div>
          </dl>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Integrations</h2>
        {connections.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No integrations connected.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {connections.map((c) => (
              <li key={c.id}>
                {c.integrationAccount.integration.provider}: <span className="text-gray-600">{c.status}</span>
                {c.lastErrorMessage && <span className="text-red-600"> — {c.lastErrorMessage}</span>}
              </li>
            ))}
          </ul>
        )}
        {canManageIntegrations && (
          <form action={connectMetricoolBrandAction.bind(null, clientId)} className="mt-3 flex flex-wrap items-end gap-2 rounded border border-gray-200 p-3">
            <div>
              <label htmlFor="brandId" className="block text-xs text-gray-500">
                Metricool brand id
              </label>
              <input
                id="brandId"
                name="brandId"
                type="text"
                required
                placeholder="e.g. 6818704"
                className="mt-1 w-40 rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="label" className="block text-xs text-gray-500">
                Label (optional)
              </label>
              <input
                id="label"
                name="label"
                type="text"
                className="mt-1 w-40 rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <button type="submit" className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              Connect Metricool brand
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Recommendations</h2>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">None yet — run an analysis above.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {recommendations.map((rec) => (
              <li key={rec.id} className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    [{rec.priority}] {rec.area}
                  </span>
                  <span className="text-xs text-gray-500">{rec.status}</span>
                </div>
                <p className="mt-1 text-gray-700">{rec.finding}</p>
                <p className="mt-1 text-gray-500">→ {rec.recommendation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No tasks.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between">
                <span>{task.title}</span>
                <span className="text-xs text-gray-500">
                  {task.priority} · {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Approvals</h2>
        {approvals.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No approval requests.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {approvals.map((approval) => (
              <li key={approval.id} className="flex items-center justify-between">
                <span>{approval.actionSummary}</span>
                <span className="text-xs text-gray-500">
                  {approval.riskLevel} · {approval.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">Reports</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No reports generated yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {reports.map((report) => (
              <li key={report.id}>
                <Link href={`/dashboard/reports/${report.id}`} className="hover:underline">
                  {report.title}
                </Link>{' '}
                <span className="text-xs text-gray-500">({report.type})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">AI runs</h2>
        {aiRuns.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No AI runs yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {aiRuns.map((run) => (
              <li key={run.id}>
                {run.model} — {run.status} ({run.createdAt.toISOString().slice(0, 16).replace('T', ' ')})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
