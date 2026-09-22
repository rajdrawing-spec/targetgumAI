import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bot } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAiRuns } from '@/lib/ai/runs'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

export default async function AiRunsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const runs = await listAiRuns(ctx, { limit: 100 })

  return (
    <div className="space-y-6">
      <PageHeader title="AI Runs" description="Every Claude call this workspace has made, with cost and timing." />

      {runs.length === 0 ? (
        <EmptyState icon={Bot} title="No AI runs yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-caption">
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-4 py-3 font-medium">Client</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Model</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Prompt</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Tokens (in/out)</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Cost</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Duration</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3">
                    {run.clientId ? (
                      <Link href={`/dashboard/clients/${run.clientId}`} className="font-medium text-foreground hover:text-primary">
                        {run.client?.name ?? run.clientId}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{run.model}</td>
                  <td className="px-4 py-3 text-muted-foreground">{run.promptVersion}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {run.inputTokens ?? '—'} / {run.outputTokens ?? '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{run.estimatedCostCents != null ? `$${(run.estimatedCostCents / 100).toFixed(3)}` : '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{run.durationMs != null ? `${run.durationMs}ms` : '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-caption">{run.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
