import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Users,
  ShieldCheck,
  Lightbulb,
  CheckSquare,
  ArrowUpRight,
  Plug,
  CalendarDays,
  Megaphone,
  KeyRound,
  ShoppingBag,
  Eye,
  DollarSign,
  Sparkles,
  BarChart3,
  Plus,
  AlertCircle,
  Activity,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAiRuns } from '@/lib/ai/runs'
import { listClientsWithSummary, attentionScore, NEEDS_ATTENTION_HEALTH } from '@/lib/clients/summary'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listApprovals } from '@/lib/approvals/approvals'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { listContentCalendarItemsForOrg } from '@/lib/content-calendar/persist'
import { listCampaigns } from '@/lib/ads/service'
import { listAccessibleClients } from '@/lib/clients/list'
import { db } from '@/lib/db/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PostScheduleDialog } from '@/components/content/post-schedule-dialog'
import { CommandCenterTelemetry } from '@/components/dashboard/command-center-telemetry'
import { MarketingSearchBar } from '@/components/dashboard/marketing-search-bar'
import { formatDate, formatRelative, initials } from '@/lib/format'
import { cn } from '@/lib/utils'

export default async function DashboardOverviewPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const [
    clients,
    pendingApprovals,
    recentAiRuns,
    connections,
    openTasks,
    upcomingContent,
    campaigns,
    accessibleClients,
  ] = await Promise.all([
    listClientsWithSummary(ctx, { sort: 'attention' }),
    listApprovals(ctx, { status: 'PENDING', limit: 5 }),
    listAiRuns(ctx, { limit: 5 }),
    listIntegrationConnectionsForOrg(ctx),
    listTasksForOrg(ctx, { status: 'OPEN', limit: 5 }),
    listContentCalendarItemsForOrg(ctx, { window: 'upcoming', limit: 5 }),
    listCampaigns(ctx),
    listAccessibleClients(ctx),
  ])

  // Calculate genuine marketing telemetry
  let totalImpressions = 0
  let totalClicks = 0
  let totalSpend = 0
  let totalRevenue = 0
  const spendByProvider: Record<string, number> = {
    META_ADS: 0,
    GOOGLE_ADS: 0,
    AMAZON_ADS: 0,
    OTHER: 0,
  }

  for (const c of campaigns) {
    totalImpressions += c.metrics.impressions
    totalClicks += c.metrics.clicks
    totalSpend += c.metrics.spend
    totalRevenue += c.metrics.revenue
    const p = c.provider in spendByProvider ? c.provider : 'OTHER'
    spendByProvider[p] = (spendByProvider[p] || 0) + c.metrics.spend
  }
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  // Calculate real daily 7-day velocity trend
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const recentMetrics = await db.campaignMetric.findMany({
    where: {
      organizationId: ctx.organizationId,
      date: { gte: sevenDaysAgo },
    },
    select: {
      date: true,
      spend: true,
      revenue: true,
    },
    orderBy: { date: 'asc' },
  })

  const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayMap = new Map<string, { spend: number; revenue: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const label = DAY_LABELS[d.getDay()]!
    dayMap.set(label, { spend: 0, revenue: 0 })
  }
  for (const m of recentMetrics) {
    const label = DAY_LABELS[new Date(m.date).getDay()]!
    const curr = dayMap.get(label) || { spend: 0, revenue: 0 }
    curr.spend += Number(m.spend || 0)
    curr.revenue += Number(m.revenue || 0)
    dayMap.set(label, curr)
  }
  const dailyTrends = Array.from(dayMap.entries()).map(([day, val]) => ({
    day,
    spend: Math.round(val.spend),
    revenue: Math.round(val.revenue),
  }))

  const channelMix = [
    {
      name: 'Meta Ads',
      spend: Math.round(spendByProvider.META_ADS || 0),
      value: totalSpend > 0 ? Math.round(((spendByProvider.META_ADS || 0) / totalSpend) * 100) : 0,
      color: '#E5252A',
    },
    {
      name: 'Google Ads',
      spend: Math.round(spendByProvider.GOOGLE_ADS || 0),
      value: totalSpend > 0 ? Math.round(((spendByProvider.GOOGLE_ADS || 0) / totalSpend) * 100) : 0,
      color: '#3B82F6',
    },
    {
      name: 'Amazon Ads',
      spend: Math.round(spendByProvider.AMAZON_ADS || 0),
      value: totalSpend > 0 ? Math.round(((spendByProvider.AMAZON_ADS || 0) / totalSpend) * 100) : 0,
      color: '#F59E0B',
    },
    {
      name: 'LinkedIn / Social',
      spend: Math.round(spendByProvider.OTHER || 0),
      value: totalSpend > 0 ? Math.round(((spendByProvider.OTHER || 0) / totalSpend) * 100) : 0,
      color: '#64748B',
    },
  ]

  const clientsNeedingAttention = clients.filter((c) => attentionScore(c) > 0).slice(0, 6)
  const totalPendingApprovals = clients.reduce((sum, c) => sum + c.attention.pendingApprovals, 0)
  const totalHighPriorityRecs = clients.reduce((sum, c) => sum + c.attention.highPriorityRecommendations, 0)
  const totalOpenTasks = clients.reduce((sum, c) => sum + c.attention.openTasks, 0)
  const canManageAds = ctx.permissions.has('ads.manage') || ctx.roleKey === 'super_admin'

  const connectionsByStatus: Record<string, number> = {}
  for (const conn of connections) {
    connectionsByStatus[conn.status] = (connectionsByStatus[conn.status] || 0) + 1
  }

  return (
    <div className="space-y-6">
      {/* Command Header */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Marketing Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time telemetry, campaign velocities, AI optimization agents, and client approval pipelines.
          </p>
        </div>

        {/* Action Command Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {canManageAds && (
            <Link href="/dashboard/ads/new" className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-3.5 w-3.5" /> New Ad Campaign
            </Link>
          )}

          <Link href="/dashboard/keywords" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <KeyRound className="h-3.5 w-3.5 text-primary" /> Keyword Engine
          </Link>

          <Link href="/dashboard/ads/analytics" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Ad Telemetry
          </Link>

          {accessibleClients.length > 0 && (
            <PostScheduleDialog clients={accessibleClients} />
          )}

          {campaigns.length === 0 && accessibleClients.length > 0 && (
            <Link
              href={`/dashboard/clients/${accessibleClients[0]?.id}/integrations`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-primary border-primary/40 hover:bg-primary-tint')}
            >
              <Plug className="h-3.5 w-3.5" /> Connect Meta Ads
            </Link>
          )}
        </div>
      </Card>

      {/* AI marketing search */}
      <MarketingSearchBar />

      {/* Action-Required & Approval Gate Alert */}
      {(totalPendingApprovals > 0 || pendingApprovals.length > 0) && (
        <div className="rounded-2xl border border-primary/25 bg-primary-tint p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-primary mr-1.5">Approval Gate Active:</span>
              <span className="text-sm text-foreground">
                {totalPendingApprovals || pendingApprovals.length} action{totalPendingApprovals === 1 ? '' : 's'} awaiting client or manager authorization before execution.
              </span>
            </div>
          </div>
          <Link href="/dashboard/approvals" className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
            <ShieldCheck className="h-3.5 w-3.5" /> Review Approvals ({totalPendingApprovals || pendingApprovals.length})
          </Link>
        </div>
      )}

      {/* Precision KPI Scorecard Ledger */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Active Workspaces"
          value={clients.length}
          href="/dashboard/clients"
          icon={Users}
          subtitle="Managed Clients"
        />
        <StatCard
          label="Tracked Impressions"
          value={totalImpressions.toLocaleString()}
          href="/dashboard/ads/analytics"
          icon={Eye}
          subtitle={`${avgCtr.toFixed(2)}% CTR`}
        />
        <StatCard
          label="Active Ad Spend"
          value={`$${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          href="/dashboard/ads"
          icon={DollarSign}
          subtitle={`${avgRoas.toFixed(1)}x ROAS`}
        />
        <StatCard
          label="Pending Approvals"
          value={totalPendingApprovals || pendingApprovals.length}
          href="/dashboard/approvals"
          icon={ShieldCheck}
          isWarning={totalPendingApprovals > 0 || pendingApprovals.length > 0}
          subtitle="Security Guardrail"
        />
        <StatCard
          label="High-Priority Recs"
          value={totalHighPriorityRecs}
          href="/dashboard/recommendations"
          icon={Lightbulb}
          isWarning={totalHighPriorityRecs > 0}
          subtitle="AI Optimizations"
        />
        <StatCard
          label="Action Items"
          value={totalOpenTasks}
          href="/dashboard/tasks"
          icon={CheckSquare}
          subtitle="Pending Work"
        />
      </div>

      {/* Interactive Charts Strip */}
      <CommandCenterTelemetry
        totalSpend={totalSpend}
        totalRevenue={totalRevenue}
        avgRoas={avgRoas}
        campaignCount={campaigns.length}
        dailyTrends={dailyTrends}
        channelMix={channelMix}
      />

      {/* Attention Required Client Ledger */}
      <Card>
        <CardHeader className="flex-row items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle>Client Workspace Health & Attention</CardTitle>
          </div>
          <Link href="/dashboard/clients" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            All Clients <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-4">
          {clientsNeedingAttention.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="All client workspaces healthy"
              description="Zero pending approvals, blocked integrations, or critical recommendations."
            />
          ) : (
            <div className="divide-y divide-border">
              {clientsNeedingAttention.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="flex min-w-0 items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground transition-colors">
                      {initials(client.name)}
                    </div>
                    <span className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {client.name}
                    </span>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2">
                    {client.attention.pendingApprovals > 0 && (
                      <Link href="/dashboard/approvals" className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-destructive-bg text-destructive hover:opacity-80">
                        {client.attention.pendingApprovals} approval{client.attention.pendingApprovals === 1 ? '' : 's'}
                      </Link>
                    )}
                    {client.attention.highPriorityRecommendations > 0 && (
                      <Link href="/dashboard/recommendations" className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-info-bg text-info hover:opacity-80">
                        {client.attention.highPriorityRecommendations} rec{client.attention.highPriorityRecommendations === 1 ? '' : 's'}
                      </Link>
                    )}
                    {client.attention.integrationIssues > 0 && (
                      <Link href={`/dashboard/clients/${client.id}/integrations`} className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-warning-bg text-warning hover:opacity-80">
                        {client.attention.integrationIssues} issue{client.attention.integrationIssues === 1 ? '' : 's'}
                      </Link>
                    )}
                    <Link href={`/dashboard/clients/${client.id}`} className="ml-2 text-xs font-semibold text-primary hover:underline">
                      Open Workspace →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Split Columns: Approvals Gate & Scheduled Operations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Pending Approvals Gate</CardTitle>
            </div>
            <Link href="/dashboard/approvals" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {pendingApprovals.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No pending approvals" />
            ) : (
              <ul className="divide-y divide-border">
                {pendingApprovals.map((approval) => (
                  <li key={approval.id} className="flex items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/dashboard/clients/${approval.clientId}`} className="font-medium text-foreground hover:text-primary transition-colors">
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

        {/* Scheduled Content & Work */}
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Upcoming Scheduled Work</CardTitle>
            </div>
            <Link href="/dashboard/content-calendar" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Calendar Hub <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Active Tasks</p>
              {openTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open tasks right now.</p>
              ) : (
                <ul className="space-y-1.5">
                  {openTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 text-xs rounded-xl bg-muted px-3 py-2">
                      <span className="truncate text-foreground">{task.title}</span>
                      <span className="shrink-0 text-muted-foreground">{task.client?.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Scheduled Posts</p>
              {upcomingContent.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingContent.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-xs rounded-xl bg-muted px-3 py-2">
                      <span className="truncate text-foreground">
                        {item.client?.name} · {item.platform}
                      </span>
                      <span className="shrink-0 font-medium text-primary">{formatDate(item.publishDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent AI Engine Runs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Recent AI Engine Executions</CardTitle>
          </div>
          <Link href="/dashboard/ai-runs" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Engine Logs <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-4">
          {recentAiRuns.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No AI runs logged yet"
              description="Trigger an analysis, campaign generation, or SEO crawl from a client workspace."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="whitespace-nowrap pb-2 font-medium">Client Workspace</th>
                    <th className="whitespace-nowrap pb-2 font-medium">Model</th>
                    <th className="whitespace-nowrap pb-2 font-medium">Status</th>
                    <th className="whitespace-nowrap pb-2 font-medium">Compute Cost</th>
                    <th className="whitespace-nowrap pb-2 font-medium text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentAiRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 font-medium text-foreground">{run.client?.name ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground">{run.model}</td>
                      <td className="py-2.5">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-2.5 tabular-nums text-muted-foreground">
                        {run.estimatedCostCents != null ? `$${(run.estimatedCostCents / 100).toFixed(3)}` : '—'}
                      </td>
                      <td className="py-2.5 tabular-nums text-muted-foreground text-right">{formatRelative(run.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  isWarning = false,
  subtitle,
}: {
  label: string
  value: string | number
  href: string
  icon: React.ComponentType<{ className?: string }>
  isWarning?: boolean
  subtitle?: string
}) {
  return (
    <Link href={href} className="group block">
      <Card className="p-3.5 space-y-1.5 transition-colors group-hover:border-primary/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
              isWarning ? 'bg-destructive-bg text-destructive' : 'bg-muted text-muted-foreground group-hover:bg-primary-tint group-hover:text-primary',
            )}
          >
            <Icon className="h-3 w-3" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 pt-0.5">
          <span className="text-xl font-display font-bold text-foreground tracking-tight">{value}</span>
        </div>

        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </Card>
    </Link>
  )
}
