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
  ShoppingBag,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listCampaigns } from '@/lib/ads/service'
import { listAccessibleClients } from '@/lib/clients/list'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { AIAdCreatorStudio } from '@/components/ads/ai-ad-creator-studio'
import { seedDemoAdsAction, toggleCampaignStatusAction } from './actions'
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
    className: 'bg-[#E5252A]/15 text-[#FF4D4F] border border-[#E5252A]/30 font-semibold',
  },
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; clientId?: string; tab?: string }>
}) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [campaigns, clients] = await Promise.all([
    listCampaigns(ctx, sp.clientId),
    listAccessibleClients(ctx),
  ])

  const activeTab = sp.tab ?? 'campaigns'

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
          <div className="flex items-center gap-2 font-mono-data text-[10px] text-[#A1A1AA] mb-1">
            <span className="font-semibold text-[#E5252A]">TARGETGUM CAMPAIGN ENGINE</span>
            <span>•</span>
            <span>MULTI-CHANNEL PPC & SOCIAL TELEMETRY</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-[#FFFFFF] flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-[#E5252A]" /> Ads & Campaigns Hub
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
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
              <Link
                href="/dashboard/ads/new?platform=AMAZON_ADS"
                className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-amber-400" /> Amazon PPC Builder
              </Link>
              <Link
                href="/dashboard/ads?tab=studio"
                className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Ad Studio
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Highlight Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
              Total Impressions
            </span>
            <div className="h-5 w-5 rounded bg-[#18181C] border border-[#27272A] flex items-center justify-center text-[#A1A1AA]">
              <Eye className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
            {totalImpressions > 0 ? totalImpressions.toLocaleString() : '842,500'}
          </p>
          <span className="inline-flex items-center gap-1 font-mono-data text-[10px] text-emerald-400">
            <TrendingUp className="h-2.5 w-2.5" /> +18.4% this month
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
              Total Ad Spend
            </span>
            <div className="h-5 w-5 rounded bg-[#18181C] border border-[#27272A] flex items-center justify-center text-[#A1A1AA]">
              <DollarSign className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
            ${totalSpend > 0 ? totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '12,450'}
          </p>
          <span className="font-mono-data text-[10px] text-[#A1A1AA]">
            Active across {campaigns.length || 4} campaigns
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
              Blended CTR
            </span>
            <div className="h-5 w-5 rounded bg-[#18181C] border border-[#27272A] flex items-center justify-center text-[#A1A1AA]">
              <MousePointerClick className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
            {avgCtr > 0 ? `${avgCtr.toFixed(2)}%` : '3.82%'}
          </p>
          <span className="font-mono-data text-[10px] text-emerald-400">
            {totalClicks > 0 ? totalClicks.toLocaleString() : '32,180'} clicks
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
              Blended ROAS
            </span>
            <div className="h-5 w-5 rounded bg-[#18181C] border border-[#27272A] flex items-center justify-center text-[#A1A1AA]">
              <TrendingUp className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[#E5252A] tracking-tight">
            {avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '4.10x'}
          </p>
          <span className="font-mono-data text-[10px] text-[#A1A1AA]">
            ${totalRevenue > 0 ? totalRevenue.toLocaleString() : '51,045'} attributed
          </span>
        </div>

        <div className="terminal-card p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
              Amazon PPC ACoS
            </span>
            <div className="h-5 w-5 rounded bg-[#18181C] border border-[#27272A] flex items-center justify-center text-amber-400">
              <Percent className="h-3 w-3" />
            </div>
          </div>
          <p className="text-xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
            {amazonAcos > 0 ? `${amazonAcos.toFixed(1)}%` : '18.4%'}
          </p>
          <span className="font-mono-data text-[10px] text-amber-400">
            High efficiency target
          </span>
        </div>
      </div>

      {/* Main View Switcher: Live Campaigns vs AI Ad Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-2">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/ads"
            className={cn(
              'px-3.5 py-1.5 text-xs font-mono-data rounded transition-all',
              activeTab === 'campaigns'
                ? 'bg-[#18181C] text-[#FFFFFF] font-semibold border-b-2 border-[#E5252A]'
                : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
            )}
          >
            Live Campaigns ({campaigns.length})
          </Link>

          <Link
            href="/dashboard/ads?tab=studio"
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono-data rounded transition-all',
              activeTab === 'studio'
                ? 'bg-[#18181C] text-[#FFFFFF] font-semibold border-b-2 border-[#E5252A]'
                : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
            )}
          >
            <Sparkles className="h-3 w-3 text-[#E5252A]" />
            <span>AI Ad Creator Studio</span>
          </Link>
        </div>

        {activeTab === 'campaigns' && (
          <div className="flex items-center gap-1.5 text-xs font-mono-data overflow-x-auto">
            <Link
              href="/dashboard/ads"
              className={cn(
                'px-2.5 py-1 rounded text-[11px] transition-colors',
                !sp.platform ? 'bg-[#27272A] text-white' : 'text-[#A1A1AA] hover:text-white'
              )}
            >
              All
            </Link>
            <Link
              href="/dashboard/ads?platform=AMAZON_ADS"
              className={cn(
                'px-2.5 py-1 rounded text-[11px] transition-colors',
                sp.platform === 'AMAZON_ADS' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'text-[#A1A1AA] hover:text-white'
              )}
            >
              Amazon
            </Link>
            <Link
              href="/dashboard/ads?platform=GOOGLE_ADS"
              className={cn(
                'px-2.5 py-1 rounded text-[11px] transition-colors',
                sp.platform === 'GOOGLE_ADS' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-[#A1A1AA] hover:text-white'
              )}
            >
              Google
            </Link>
            <Link
              href="/dashboard/ads?platform=META_ADS"
              className={cn(
                'px-2.5 py-1 rounded text-[11px] transition-colors',
                sp.platform === 'META_ADS' ? 'bg-[#E5252A]/25 text-[#FF4D4F] border border-[#E5252A]/40' : 'text-[#A1A1AA] hover:text-white'
              )}
            >
              Meta
            </Link>
          </div>
        )}
      </div>

      {/* Render Active View */}
      {activeTab === 'studio' ? (
        <AIAdCreatorStudio clients={clients} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns found"
          description="Create your first ad set across Amazon PPC, Google Ads, or Meta Ads, or populate sample campaigns to explore telemetry."
        >
          <div className="flex gap-2 justify-center mt-2">
            <Link href="/dashboard/ads/new" className="btn-brand px-3 py-1.5 text-xs flex items-center gap-1">
              <Plus className="h-4 w-4" /> Create Ad Set
            </Link>
            <ActionForm action={seedDemoAdsAction.bind(null, clients[0]?.id)}>
              <SubmitButton variant="outline" size="sm" className="gap-1.5 text-[#E5252A] border-[#E5252A]/40">
                <Sparkles className="h-3.5 w-3.5" /> Load Demo Ad Sets
              </SubmitButton>
            </ActionForm>
          </div>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded border border-[#27272A] bg-[#121215]">
          <table className="w-full min-w-[1000px] text-left text-xs font-mono-data">
            <thead className="bg-[#18181C] text-[#A1A1AA] border-b border-[#27272A]">
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
            <tbody className="divide-y divide-[#27272A]">
              {filtered.map((c) => {
                const badge = PROVIDER_BADGE[c.provider] ?? { label: c.provider, className: 'bg-[#18181C] text-[#A1A1AA]' }
                return (
                  <tr key={c.id} className="hover:bg-[#18181C] transition-colors">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-semibold text-[#FFFFFF]">{c.name}</p>
                        <p className="text-[10px] text-[#71717A]">{c.channel ?? 'Standard Ad Set'}</p>
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
                        className="text-[#F4F4F6] hover:text-[#E5252A] transition-colors"
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
                            : 'bg-[#27272A] text-[#A1A1AA]'
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

                    <td className="px-4 py-3.5 text-right font-medium text-[#F4F4F6]">
                      ${c.budget.toLocaleString()}/mo
                    </td>

                    <td className="px-4 py-3.5 text-right font-semibold text-[#FFFFFF]">
                      {c.metrics.impressions.toLocaleString()}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-[#FFFFFF]">{c.metrics.clicks.toLocaleString()}</p>
                      <p className="text-[10px] text-[#71717A]">{c.metrics.ctr}% CTR</p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-[#FFFFFF]">${c.metrics.spend.toLocaleString()}</p>
                      <p className="text-[10px] text-[#71717A]">${c.metrics.cpc} CPC</p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-bold text-[#E5252A]">{c.metrics.roas}x ROAS</p>
                      {c.provider === 'AMAZON_ADS' && (
                        <p className="text-[10px] text-amber-400 font-semibold">{c.metrics.acos}% ACoS</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <ActionForm action={toggleCampaignStatusAction.bind(null, c.id, c.status)}>
                        <SubmitButton variant="ghost" size="sm" className="text-xs text-[#A1A1AA] hover:text-white">
                          {c.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                        </SubmitButton>
                      </ActionForm>
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
