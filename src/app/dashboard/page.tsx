import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, ShieldCheck, Lightbulb, CheckSquare, ArrowUpRight, Plug, CalendarDays, TrendingUp } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAiRuns } from '@/lib/ai/runs'
import { listClientsWithSummary, attentionScore, NEEDS_ATTENTION_HEALTH } from '@/lib/clients/summary'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listApprovals } from '@/lib/approvals/approvals'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { listContentCalendarItemsForOrg } from '@/lib/content-calendar/persist'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatRelative, initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Agency Overview (docs/UX-ASSESSMENT.md §18 / BRD Section 42): "what
 * needs attention across every client right now" - not a tile wall. Built
 * on the same `listClientsWithSummary` query the Clients list uses, so
 * "Attention" here and there always agree.
 */
export default async function DashboardOverviewPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const [clients, pendingApprovals, recentAiRuns, connections, openTasks, upcomingContent] = await Promise.all([
    listClientsWithSummary(ctx, { sort: 'attention' }),
    listApprovals(ctx, { status: 'PENDING', limit: 5 }),
    listAiRuns(ctx, { limit: 5 }),
    listIntegrationConnectionsForOrg(ctx),
    listTasksForOrg(ctx, { status: 'OPEN', limit: 5 }),
    listContentCalendarItemsForOrg(ctx, { window: 'upcoming', limit: 5 }),
  ])

  const clientsNeedingAttention = clients.filter((c) => attentionScore(c) > 0).slice(0, 6)
  const totalPendingApprovals = clients.reduce((sum, c) => sum + c.attention.pendingApprovals, 0)
  const totalHighPriorityRecs = clients.reduce((sum, c) => sum + c.attention.highPriorityRecommendations, 0)
  const totalOpenTasks = clients.reduce((sum, c) => sum + c.attention.openTasks, 0)
  const integrationIssues = connections.filter((c) => NEEDS_ATTENTION_HEALTH.includes(c.status))
  const connectionsByStatus = connections.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="What needs attention across every client you can see." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active clients" value={clients.length} href="/dashboard/clients" icon={Users} />
        <StatCard label="Pending approvals" value={totalPendingApprovals} href="/dashboard/approvals" icon={ShieldCheck} tone={totalPendingApprovals > 0 ? 'warning' : 'default'} />
        <StatCard label="High-priority recommendations" value={totalHighPriorityRecs} href="/dashboard/recommendations" icon={Lightbulb} tone={totalHighPriorityRecs > 0 ? 'warning' : 'default'} />
        <StatCard label="Open tasks" value={totalOpenTasks} href="/dashboard/tasks" icon={CheckSquare} />
        <StatCard label="Integration issues" value={integrationIssues.length} href="/dashboard/integrations?status=attention" icon={Plug} tone={integrationIssues.length > 0 ? 'warning' : 'default'} />
      </div>

      {/* Attention Required - per-client, actionable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attention required</CardTitle>
        </CardHeader>
        <CardContent>
          {clientsNeedingAttention.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nothing needs attention right now" description="Every client is caught up - no pending approvals, high-priority recommendations, or integration issues." />
          ) : (
            <ul className="divide-y divide-border">
              {clientsNeedingAttention.map((client) => (
                <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <Link href={`/dashboard/clients/${client.id}`} className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-medium text-accent-foreground">
                      {initials(client.name)}
                    </div>
                    <span className="truncate text-sm font-medium text-foreground hover:text-primary">{client.name}</span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {client.attention.pendingApprovals > 0 && (
                      <Link href="/dashboard/approvals" className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning hover:underline">
                        {client.attention.pendingApprovals} approval{client.attention.pendingApprovals === 1 ? '' : 's'}
                      </Link>
                    )}
                    {client.attention.highPriorityRecommendations > 0 && (
                      <Link href="/dashboard/recommendations" className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info hover:underline">
                        {client.attention.highPriorityRecommendations} rec{client.attention.highPriorityRecommendations === 1 ? '' : 's'}
                      </Link>
                    )}
                    {client.attention.integrationIssues > 0 && (
                      <Link href={`/dashboard/clients/${client.id}/integrations`} className="rounded-full bg-destructive-bg px-2 py-0.5 text-xs font-medium text-destructive hover:underline">
                        {client.attention.integrationIssues} integration{client.attention.integrationIssues === 1 ? '' : 's'}
                      </Link>
                    )}
                    <Link href={`/dashboard/clients/${client.id}`} className="ml-1 text-xs font-medium text-primary hover:underline">
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Pending approvals
            </CardTitle>
            <Link href="/dashboard/approvals" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nothing pending" />
            ) : (
              <ul className="divide-y divide-border">
                {pendingApprovals.map((approval) => (
                  <li key={approval.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/dashboard/clients/${approval.clientId}`} className="text-foreground hover:text-primary">
                        {approval.client.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{approval.actionSummary}</p>
                    </div>
                    <StatusBadge status={approval.riskLevel} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-muted-foreground" /> Upcoming work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-caption">Open tasks</p>
              {openTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing open.</p>
              ) : (
                <ul className="space-y-1">
                  {openTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-foreground">{task.title}</span>
                      <span className="shrink-0 text-xs text-caption">{task.client?.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-caption">Scheduled content</p>
              {upcomingContent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-1">
                  {upcomingContent.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-foreground">{item.client?.name} · {item.platform}</span>
                      <span className="shrink-0 text-xs tabular-nums text-caption">{formatDate(item.publishDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
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
            <EmptyState icon={Plug} title="No integrations connected yet" description="Connect a client to Metricool, Google Ads, Meta Ads or Canva from its workspace to start pulling real data." />
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
            <EmptyState icon={Users} title="No AI runs yet" description="Run an analysis from a client's workspace to see it here." />
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
                      <td className="py-2.5 tabular-nums text-caption">{formatRelative(run.createdAt)}</td>
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
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Performance summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={TrendingUp}
            title="No connected data sources yet"
            description="Spend, leads, ROAS and traffic roll up here once clients have connected ad and analytics accounts - never estimated or fabricated in the meantime."
          />
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
