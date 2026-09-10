import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, ShieldCheck, Lightbulb, CheckSquare, ArrowUpRight, Plug } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAiRuns } from '@/lib/ai/runs'
import { listAccessibleClients } from '@/lib/clients/list'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { listApprovals } from '@/lib/approvals/approvals'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

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
      <PageHeader title="Overview" description="What needs attention across every client you can see." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active clients" value={clients.length} href="/dashboard/clients" icon={Users} />
        <StatCard
          label="Pending approvals"
          value={pendingApprovals.length}
          href="/dashboard/approvals"
          icon={ShieldCheck}
          tone={pendingApprovals.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="High-priority recommendations"
          value={highPriorityRecs.length}
          href="/dashboard/recommendations"
          icon={Lightbulb}
          tone={highPriorityRecs.length > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Open tasks" value={openTasks.length} href="/dashboard/tasks" icon={CheckSquare} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-muted-foreground" /> Integration health
          </CardTitle>
          <Link href="/dashboard/integrations" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <EmptyState icon={Plug} title="No integrations connected yet" description="Connect a client to Metricool from its detail page to start pulling real data." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(connectionsByStatus).map(([status, count]) => (
                <StatusBadge key={status} status={status} className="gap-1.5">
                  <span className="font-medium tabular-nums">{count}</span>
                </StatusBadge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent AI runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAiRuns.length === 0 ? (
            <EmptyState icon={Users} title="No AI runs yet" description="Run an analysis from a client's page to see it here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-caption">
                  <tr>
                    <th className="pb-2 font-medium">Client</th>
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentAiRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2.5 font-medium">{run.client?.name ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground">{run.model}</td>
                      <td className="py-2.5">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-2.5 tabular-nums text-muted-foreground">
                        {run.estimatedCostCents != null ? `$${(run.estimatedCostCents / 100).toFixed(3)}` : '—'}
                      </td>
                      <td className="py-2.5 tabular-nums text-caption">{run.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">High-priority recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {highPriorityRecs.length === 0 ? (
            <EmptyState icon={Lightbulb} title="Nothing needs attention right now" />
          ) : (
            <ul className="divide-y divide-border">
              {highPriorityRecs.map((rec) => (
                <li key={rec.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/dashboard/clients/${rec.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                    {rec.client?.name ?? rec.clientId}
                  </Link>
                  <p className="text-sm text-muted-foreground">{rec.finding}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number
  href: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'warning'
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-popover">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-2xl font-medium tabular-nums tracking-tight text-foreground">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              tone === 'warning' && value > 0 ? 'bg-warning-bg text-warning' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
