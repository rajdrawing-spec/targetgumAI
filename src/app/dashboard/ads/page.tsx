import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Megaphone,
  Plus,
  BarChart3,
  TrendingUp,
  DollarSign,
  Eye,
  MousePointerClick,
  Percent,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listCampaigns } from '@/lib/ads/service'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { toggleCampaignStatusAction, syncMetaAdsAction } from './actions'
import { cn } from '@/lib/utils'

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  AMAZON_ADS: {
    label: 'Amazon PPC',
    className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold',
  },
  GOOGLE_ADS: {
    label: 'Google Ads',
    className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold',
  },
  META_ADS: {
    label: 'Meta Ads',
    className: 'bg-[#E5252A]/15 text-[var(--danger-text-hex)] border border-[#E5252A]/30 font-semibold',
  },
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; clientId?: string }>
}) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const campaigns = await listCampaigns(ctx, sp.clientId)

  const filtered = sp.platform
    ? campaigns.filter((c) => c.provider === sp.platform)
    : campaigns

  // Aggregated totals
  let totalImpressions = 0
  let totalClicks = 0
  let totalSpend = 0
  let totalRevenue = 0
  let amazonSpend = 0
  let amazonRevenue = 0

  for (const c of campaigns) {
    totalImpressions += c.metrics.impressions
    totalClicks += c.metrics.clicks
    totalSpend += c.metrics.spend
    totalRevenue += c.metrics.revenue
    if (c.provider === 'AMAZON_ADS') {
      amazonSpend += c.metrics.spend
      amazonRevenue += c.metrics.revenue
    }
  }

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const amazonAcos = amazonRevenue > 0 ? (amazonSpend / amazonRevenue) * 100 : 0

  const canManageAds = ctx.permissions.has('ads.manage') || ctx.roleKey === 'super_admin'

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="terminal-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono-data text-[10px] text-[var(--text-muted-hex)] mb-1">
            <span className="font-semibold text-[#E5252A]">TARGETGUM CAMPAIGN ENGINE</span>
            <span>•</span>
            <span>MULTI-CHANNEL PPC & SOCIAL TELEMETRY</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-[var(--text-primary-hex)] flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-[#E5252A]" /> Ads & Campaigns Hub
          </h1>
          <p className="text-xs text-[var(--text-muted-hex)] mt-1">
            Manage multi-platform ad sets across Amazon PPC, Google Ads, and Meta Ads with automated AI impression tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/ads/analytics"
            className="btn-outline-hairline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <BarChart3 className="h-3.5 w-3.5 text-[#E5252A]" /> Telemetry Analytics
          </Link>

          {canManageAds && (
            <>
              <ActionForm action={syncMetaAdsAction.bind(null, sp.clientId)}>
                <SubmitButton
                  variant="outline"
                  size="sm"
                  pendingLabel="Syncing..."
                  className="btn-outline-hairline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white hover:border-[#E5252A]/50"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#E5252A]" /> Sync Meta Telemetry
                </SubmitButton>
              </ActionForm>
              <Link
                href="/dashboard/ads/new"
                className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> Create Ad Campaign
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Highlight Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)]">
              Total Impressions
            </span>
            <div className="h-5 w-5 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted-hex)]">
              <Eye className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[var(--text-primary-hex)] tracking-tight">
            {totalImpressions.toLocaleString()}
          </p>
          <span className="inline-flex items-center gap-1 font-mono-data text-[10px] text-[var(--text-muted-hex)]">
            <TrendingUp className="h-2.5 w-2.5 text-[#E5252A]" /> Live telemetry
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)]">
              Total Ad Spend
            </span>
            <div className="h-5 w-5 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted-hex)]">
              <DollarSign className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[var(--text-primary-hex)] tracking-tight">
            ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
          <span className="font-mono-data text-[10px] text-[var(--text-muted-hex)]">
            Active across {campaigns.length} campaigns
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)]">
              Blended CTR
            </span>
            <div className="h-5 w-5 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted-hex)]">
              <MousePointerClick className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[var(--text-primary-hex)] tracking-tight">
            {avgCtr.toFixed(2)}%
          </p>
          <span className="font-mono-data text-[10px] text-[var(--text-muted-hex)]">
            {totalClicks.toLocaleString()} total clicks
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)]">
              Blended ROAS
            </span>
            <div className="h-5 w-5 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted-hex)]">
              <TrendingUp className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[#E5252A] tracking-tight">
            {avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '0.00x'}
          </p>
          <span className="font-mono-data text-[10px] text-[var(--text-muted-hex)]">
            ${totalRevenue.toLocaleString()} attributed
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)]">
              Amazon PPC ACoS
            </span>
            <div className="h-5 w-5 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-amber-400">
              <Percent className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[var(--text-primary-hex)] tracking-tight">
            {amazonAcos.toFixed(1)}%
          </p>
          <span className="font-mono-data text-[10px] text-[var(--text-muted-hex)]">
            {amazonSpend > 0 ? `$${amazonSpend.toLocaleString()} spend` : 'No Amazon spend'}
          </span>
        </div>
      </div>

      {/* Platform filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-2">
        <span className="px-1 text-xs font-mono-data font-semibold text-[var(--text-primary-hex)]">Live Campaigns ({campaigns.length})</span>

        <div className="flex items-center gap-1.5 text-xs font-mono-data overflow-x-auto">
          <Link
            href="/dashboard/ads"
            className={cn(
              'px-2.5 py-1 rounded text-[11px] transition-colors',
              !sp.platform ? 'bg-[var(--border-hairline)] text-white' : 'text-[var(--text-muted-hex)] hover:text-white'
            )}
          >
            All
          </Link>
          <Link
            href="/dashboard/ads?platform=AMAZON_ADS"
            className={cn(
              'px-2.5 py-1 rounded text-[11px] transition-colors',
              sp.platform === 'AMAZON_ADS' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'text-[var(--text-muted-hex)] hover:text-white'
            )}
          >
            Amazon
          </Link>
          <Link
            href="/dashboard/ads?platform=GOOGLE_ADS"
            className={cn(
              'px-2.5 py-1 rounded text-[11px] transition-colors',
              sp.platform === 'GOOGLE_ADS' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-[var(--text-muted-hex)] hover:text-white'
            )}
          >
            Google
          </Link>
          <Link
            href="/dashboard/ads?platform=META_ADS"
            className={cn(
              'px-2.5 py-1 rounded text-[11px] transition-colors',
              sp.platform === 'META_ADS' ? 'bg-[#E5252A]/25 text-[var(--danger-text-hex)] border border-[#E5252A]/40' : 'text-[var(--text-muted-hex)] hover:text-white'
            )}
          >
            Meta
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Connect an ad account to stream in live campaigns, or use the guided wizard to create your first one - no marketing experience needed."
        >
          <div className="flex gap-2 justify-center mt-2">
            <Link href="/dashboard/ads/new" className="btn-brand px-3.5 py-1.5 text-xs flex items-center gap-1 font-semibold">
              <Plus className="h-4 w-4" /> Create Ad Campaign
            </Link>
            <Link href="/dashboard/integrations" className="btn-outline-hairline px-3.5 py-1.5 text-xs flex items-center gap-1 font-medium">
              <BarChart3 className="h-4 w-4 text-[#E5252A]" /> Connect an ad account
            </Link>
          </div>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-base)]">
          <table className="w-full min-w-[1000px] text-left text-xs font-mono-data">
            <thead className="bg-[var(--surface-subtle)] text-[var(--text-muted-hex)] border-b border-[var(--border-hairline)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Campaign / Ad Set</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Client Workspace</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Budget</th>
                <th className="px-4 py-3 text-right font-semibold">Impressions</th>
                <th className="px-4 py-3 text-right font-semibold">Clicks (CTR)</th>
                <th className="px-4 py-3 text-right font-semibold">Spend (CPC)</th>
                <th className="px-4 py-3 text-right font-semibold">ROAS / ACoS</th>
                <th className="px-4 py-3 text-right font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {filtered.map((c) => {
                const badge = PROVIDER_BADGE[c.provider] ?? { label: c.provider, className: 'bg-[var(--surface-subtle)] text-[var(--text-muted-hex)]' }
                return (
                  <tr key={c.id} className="hover:bg-[var(--surface-subtle)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-semibold text-[var(--text-primary-hex)]">{c.name}</p>
                        <p className="text-[10px] text-[var(--text-faint-hex)]">{c.channel ?? 'Standard Ad Set'}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <Link
                        href={`/dashboard/clients/${c.clientId}`}
                        className="text-[var(--text-primary-hex)] hover:text-[#E5252A] transition-colors"
                      >
                        {c.clientName}
                      </Link>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[var(--border-hairline)] text-[var(--text-muted-hex)]'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            c.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-400'
                          )}
                        />
                        {c.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-[var(--text-primary-hex)]">
                      ${c.budget.toLocaleString()}/mo
                    </td>

                    <td className="px-4 py-3.5 text-right font-semibold text-[var(--text-primary-hex)]">
                      {c.metrics.impressions.toLocaleString()}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-[var(--text-primary-hex)]">{c.metrics.clicks.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--text-faint-hex)]">{c.metrics.ctr}% CTR</p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-[var(--text-primary-hex)]">${c.metrics.spend.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--text-faint-hex)]">${c.metrics.cpc} CPC</p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-bold text-[#E5252A]">{c.metrics.roas}x ROAS</p>
                      {c.provider === 'AMAZON_ADS' && (
                        <p className="text-[10px] text-amber-400 font-semibold">{c.metrics.acos}% ACoS</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {c.approvalId ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Pending approval
                          </span>
                          <Link href="/dashboard/approvals" className="text-[10px] text-[var(--text-muted-hex)] hover:text-[#E5252A] hover:underline">
                            Review on Approvals Gate →
                          </Link>
                        </div>
                      ) : (
                        <ActionForm action={toggleCampaignStatusAction.bind(null, c.id, c.status)}>
                          <SubmitButton variant="ghost" size="sm" className="text-xs text-[var(--text-muted-hex)] hover:text-white">
                            {c.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
