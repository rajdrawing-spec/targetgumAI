import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAiRuns } from '@/lib/ai/runs'

export default async function AiRunsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const runs = await listAiRuns(ctx, { limit: 100 })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">AI Runs</h1>
      {runs.length === 0 ? (
        <p className="text-sm text-gray-400">No AI runs yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500">
            <tr>
              <th className="pb-2 font-medium">Client</th>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium">Prompt</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Tokens (in/out)</th>
              <th className="pb-2 font-medium">Cost</th>
              <th className="pb-2 font-medium">Duration</th>
              <th className="pb-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="py-2">
                  {run.clientId ? (
                    <Link href={`/dashboard/clients/${run.clientId}`} className="hover:underline">
                      {run.client?.name ?? run.clientId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2">{run.model}</td>
                <td className="py-2 text-gray-500">{run.promptVersion}</td>
                <td className="py-2">{run.status}</td>
                <td className="py-2 text-gray-500">
                  {run.inputTokens ?? '—'} / {run.outputTokens ?? '—'}
                </td>
                <td className="py-2">{run.estimatedCostCents != null ? `$${(run.estimatedCostCents / 100).toFixed(3)}` : '—'}</td>
                <td className="py-2 text-gray-500">{run.durationMs != null ? `${run.durationMs}ms` : '—'}</td>
                <td className="py-2 text-gray-500">{run.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
