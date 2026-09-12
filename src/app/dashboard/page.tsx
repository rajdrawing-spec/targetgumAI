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
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PostScheduleDialog } from '@/components/content/post-schedule-dialog'
import { CommandCenterTelemetry } from '@/components/dashboard/command-center-telemetry'
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
      {/* Precision Command Header */}
      <div className="terminal-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono-data text-[10px] text-[#A1A1AA] mb-1">
            <span className="font-semibold text-[#FFFFFF] tracking-wider">TARGETGUM OPERATING SYSTEM</span>
            <span>•</span>
            <span className="text-[#E5252A] font-semibold">PRECISION MARKETING TERMINAL</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-[#FFFFFF] flex items-center gap-2">
            Marketing Command Center
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Real-time telemetry, campaign velocities, AI optimization agents, and client approval pipelines.
          </p>
        </div>

        {/* Action Command Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {canManageAds && (
            <>
              <Link
                href="/dashboard/ads/new"
                className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> New Ad Brief
              </Link>
              <Link
                href="/dashboard/ads/new?platform=AMAZON_ADS"
                className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-amber-400" /> Amazon PPC
              </Link>
            </>
          )}

          <Link
            href="/dashboard/keywords"
            className="btn-outline-hairline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#E5252A]" /> Keyword Engine
          </Link>

          <Link
            href="/dashboard/ads/analytics"
            className="btn-outline-hairline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <BarChart3 className="h-3.5 w-3.5 text-[#E5252A]" /> Ad Telemetry
          </Link>

          {accessibleClients.length > 0 && (
            <PostScheduleDialog clients={accessibleClients} />
          )}

          {campaigns.length === 0 && accessibleClients.length > 0 && (
            <Link
              href={`/dashboard/clients/${accessibleClients[0]?.id}/integrations`}
              className="btn-outline-hairline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E5252A] border-[#E5252A]/40 hover:bg-[#E5252A]/10"
            >
              <Plug className="h-3.5 w-3.5" /> Connect Meta Ads
            </Link>
          )}
        </div>
      </div>

      {/* Action-Required & Approval Gate Alert */}
      {(totalPendingApprovals > 0 || pendingApprovals.length > 0) && (
        <div className="terminal-alert-rust p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#E5252A]/10 border border-[#E5252A]/40 rounded">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#E5252A]/20 text-[#FF4D4F]">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mono-data text-xs font-bold uppercase tracking-wider text-[#FF4D4F] mr-2">
                Approval Gate Active:
              </span>
              <span className="text-xs text-[#F4F4F6]">
                {totalPendingApprovals || pendingApprovals.length} action{totalPendingApprovals === 1 ? '' : 's'} awaiting client or manager authorization before execution.
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/approvals"
            className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shrink-0"
          >
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
      <div className="terminal-card">
        <div className="flex items-center justify-between border-b border-[#27272A] px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#E5252A]" />
            <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Client Workspace Health & Attention
            </h2>
          </div>
          <Link
            href="/dashboard/clients"
            className="flex items-center gap-1 font-mono-data text-xs text-[#E5252A] hover:underline"
          >
            All Clients <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-4">
          {clientsNeedingAttention.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="All client workspaces healthy"
              description="Zero pending approvals, blocked integrations, or critical recommendations."
            />
          ) : (
            <div className="divide-y divide-[#27272A]">
              {clientsNeedingAttention.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="flex min-w-0 items-center gap-3 group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#18181C] border border-[#27272A] text-xs font-mono-data font-bold text-[#FFFFFF] group-hover:border-[#E5252A] transition-colors">
                      {initials(client.name)}
                    </div>
                    <span className="truncate text-sm font-medium text-[#F4F4F6] group-hover:text-[#E5252A] transition-colors">
                      {client.name}
                    </span>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2">
                    {client.attention.pendingApprovals > 0 && (
                      <Link
                        href="/dashboard/approvals"
                        className="rounded px-2 py-0.5 text-xs font-mono-data font-medium bg-[#E5252A]/15 text-[#FF4D4F] border border-[#E5252A]/30 hover:bg-[#E5252A]/25"
                      >
                        {client.attention.pendingApprovals} approval{client.attention.pendingApprovals === 1 ? '' : 's'}
                      </Link>
                    )}
                    {client.attention.highPriorityRecommendations > 0 && (
                      <Link
                        href="/dashboard/recommendations"
                        className="rounded px-2 py-0.5 text-xs font-mono-data font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
                      >
                        {client.attention.highPriorityRecommendations} rec{client.attention.highPriorityRecommendations === 1 ? '' : 's'}
                      </Link>
                    )}
                    {client.attention.integrationIssues > 0 && (
                      <Link
                        href={`/dashboard/clients/${client.id}/integrations`}
                        className="rounded px-2 py-0.5 text-xs font-mono-data font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                      >
                        {client.attention.integrationIssues} issue{client.attention.integrationIssues === 1 ? '' : 's'}
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="ml-2 font-mono-data text-xs text-[#E5252A] hover:underline"
                    >
                      Open Workspace →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Split Columns: Approvals Gate & Scheduled Operations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pending Approvals */}
        <div className="terminal-card">
          <div className="flex items-center justify-between border-b border-[#27272A] px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#A1A1AA]" />
              <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
                Pending Approvals Gate
              </h3>
            </div>
            <Link
              href="/dashboard/approvals"
              className="flex items-center gap-1 font-mono-data text-xs text-[#E5252A] hover:underline"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-4">
            {pendingApprovals.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No pending approvals" />
            ) : (
              <ul className="divide-y divide-[#27272A]">
                {pendingApprovals.map((approval) => (
                  <li
                    key={approval.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/clients/${approval.clientId}`}
                        className="font-medium text-[#F4F4F6] hover:text-[#E5252A] transition-colors"
                      >
                        {approval.client.name}
                      </Link>
                      <p className="truncate text-xs text-[#A1A1AA]">{approval.actionSummary}</p>
                    </div>
                    <StatusBadge status={approval.riskLevel} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Scheduled Content & Work */}
        <div className="terminal-card">
          <div className="flex items-center justify-between border-b border-[#27272A] px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#A1A1AA]" />
              <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
                Upcoming Scheduled Work
              </h3>
            </div>
            <Link
              href="/dashboard/content-calendar"
              className="flex items-center gap-1 font-mono-data text-xs text-[#E5252A] hover:underline"
            >
              Calendar Hub <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="mb-1.5 font-mono-data text-[10px] uppercase tracking-wider text-[#71717A]">
                Active Tasks
              </p>
              {openTasks.length === 0 ? (
                <p className="text-xs text-[#A1A1AA]">No open tasks right now.</p>
              ) : (
                <ul className="space-y-1.5">
                  {openTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 text-xs rounded bg-[#18181C] px-2.5 py-1.5 border border-[#27272A]"
                    >
                      <span className="truncate text-[#F4F4F6]">{task.title}</span>
                      <span className="shrink-0 font-mono-data text-[10px] text-[#A1A1AA]">
                        {task.client?.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-2 border-t border-[#27272A]">
              <p className="mb-1.5 font-mono-data text-[10px] uppercase tracking-wider text-[#71717A]">
                Scheduled Posts
              </p>
              {upcomingContent.length === 0 ? (
                <p className="text-xs text-[#A1A1AA]">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingContent.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-xs rounded bg-[#18181C] px-2.5 py-1.5 border border-[#27272A]"
                    >
                      <span className="truncate text-[#F4F4F6]">
                        {item.client?.name} · {item.platform}
                      </span>
                      <span className="shrink-0 font-mono-data text-[10px] text-[#E5252A]">
                        {formatDate(item.publishDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent AI Engine Runs */}
      <div className="terminal-card">
        <div className="flex items-center justify-between border-b border-[#27272A] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E5252A]" />
            <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Recent AI Engine Executions
            </h3>
          </div>
          <Link
            href="/dashboard/ai-runs"
            className="flex items-center gap-1 font-mono-data text-xs text-[#E5252A] hover:underline"
          >
            Engine Logs <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-4">
          {recentAiRuns.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No AI runs logged yet"
              description="Trigger an analysis, campaign generation, or SEO crawl from a client workspace."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-data">
                <thead className="text-[#71717A] border-b border-[#27272A]">
                  <tr>
                    <th className="pb-2 font-medium">Client Workspace</th>
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Compute Cost</th>
                    <th className="pb-2 font-medium text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {recentAiRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-[#18181C] transition-colors">
                      <td className="py-2.5 font-medium text-[#FFFFFF]">{run.client?.name ?? '—'}</td>
                      <td className="py-2.5 text-[#A1A1AA]">{run.model}</td>
                      <td className="py-2.5">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-2.5 text-[#A1A1AA]">
                        {run.estimatedCostCents != null
                          ? `$${(run.estimatedCostCents / 100).toFixed(3)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 text-[#71717A] text-right">
                        {formatRelative(run.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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
    <Link href={href} className="group">
      <div className="terminal-card p-3.5 space-y-1.5 transition-all duration-150 group-hover:border-[#E5252A]/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
            {label}
          </span>
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded border transition-colors',
              isWarning
                ? 'bg-[#E5252A]/15 text-[#FF4D4F] border-[#E5252A]/40'
                : 'bg-[#18181C] text-[#A1A1AA] border-[#27272A] group-hover:text-[#E5252A] group-hover:border-[#E5252A]/40'
            )}
          >
            <Icon className="h-3 w-3" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 pt-0.5">
          <span className="text-xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
            {value}
          </span>
        </div>

        {subtitle && (
          <p className="text-[10px] font-mono-data text-[#71717A] group-hover:text-[#A1A1AA] transition-colors">
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  )
}
