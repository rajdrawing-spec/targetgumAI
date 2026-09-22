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
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { toggleCampaignStatusAction, syncMetaAdsAction } from './actions'
import { cn } from '@/lib/utils'

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  AMAZON_ADS: { label: 'Amazon PPC', className: 'bg-warning-bg text-warning' },
  GOOGLE_ADS: { label: 'Google Ads', className: 'bg-info-bg text-info' },
  META_ADS: { label: 'Meta Ads', className: 'bg-destructive-bg text-destructive' },
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

  const PLATFORM_TABS = [
    { value: undefined, label: 'All' },
    { value: 'AMAZON_ADS', label: 'Amazon' },
    { value: 'GOOGLE_ADS', label: 'Google' },
    { value: 'META_ADS', label: 'Meta' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-primary" /> Ads & Campaigns Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multi-platform ad sets across Amazon PPC, Google Ads, and Meta Ads with automated AI impression tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/dashboard/ads/analytics" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Telemetry Analytics
          </Link>

          {canManageAds && (
            <>
              <ActionForm action={syncMetaAdsAction.bind(null, sp.clientId)}>
                <SubmitButton variant="outline" size="sm" pendingLabel="Syncing...">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" /> Sync Meta Telemetry
                </SubmitButton>
              </ActionForm>
              <Link href="/dashboard/ads/new" className={buttonVariants({ size: 'sm' })}>
                <Sparkles className="h-3.5 w-3.5" /> Create Ad Campaign
              </Link>
            </>
          )}
        </div>
      </Card>

      {/* Primary KPI Highlight Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AdStat label="Total Impressions" value={totalImpressions.toLocaleString()} icon={Eye} sub="Live telemetry" />
        <AdStat label="Total Ad Spend" value={`$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={DollarSign} sub={`Active across ${campaigns.length} campaigns`} />
        <AdStat label="Blended CTR" value={`${avgCtr.toFixed(2)}%`} icon={MousePointerClick} sub={`${totalClicks.toLocaleString()} total clicks`} />
        <AdStat label="Blended ROAS" value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '0.00x'} icon={TrendingUp} accent sub={`$${totalRevenue.toLocaleString()} attributed`} />
        <AdStat label="Amazon PPC ACoS" value={`${amazonAcos.toFixed(1)}%`} icon={Percent} sub={amazonSpend > 0 ? `$${amazonSpend.toLocaleString()} spend` : 'No Amazon spend'} />
      </div>

      {/* Platform filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">Live Campaigns ({campaigns.length})</span>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {PLATFORM_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.value ? `/dashboard/ads?platform=${tab.value}` : '/dashboard/ads'}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                sp.platform === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Connect an ad account to stream in live campaigns, or use the guided wizard to create your first one - no marketing experience needed."
        >
          <div className="flex gap-2 justify-center mt-2">
            <Link href="/dashboard/ads/new" className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4" /> Create Ad Campaign
            </Link>
            <Link href="/dashboard/integrations" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <BarChart3 className="h-4 w-4 text-primary" /> Connect an ad account
            </Link>
          </div>
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Campaign / Ad Set</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Platform</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Client Workspace</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Budget</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Impressions</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Clicks (CTR)</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Spend (CPC)</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ROAS / ACoS</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const badge = PROVIDER_BADGE[c.provider] ?? { label: c.provider, className: 'bg-muted text-muted-foreground' }
                return (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.channel ?? 'Standard Ad Set'}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', badge.className)}>{badge.label}</span>
                    </td>

                    <td className="px-4 py-3.5">
                      <Link href={`/dashboard/clients/${c.clientId}`} className="text-foreground hover:text-primary transition-colors">
                        {c.clientName}
                      </Link>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          c.status === 'ACTIVE' ? 'bg-success-bg text-success' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', c.status === 'ACTIVE' ? 'bg-success' : 'bg-muted-foreground')} />
                        {c.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-foreground">${c.budget.toLocaleString()}/mo</td>

                    <td className="px-4 py-3.5 text-right font-semibold text-foreground tabular-nums">{c.metrics.impressions.toLocaleString()}</td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-foreground tabular-nums">{c.metrics.clicks.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{c.metrics.ctr}% CTR</p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-foreground tabular-nums">${c.metrics.spend.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">${c.metrics.cpc} CPC</p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <p className="font-bold text-primary tabular-nums">{c.metrics.roas}x ROAS</p>
                      {c.provider === 'AMAZON_ADS' && <p className="text-xs text-warning font-semibold">{c.metrics.acos}% ACoS</p>}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {c.approvalId ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">
                            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                            Pending approval
                          </span>
                          <Link href="/dashboard/approvals" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                            Review on Approvals Gate →
                          </Link>
                        </div>
                      ) : (
                        <ActionForm action={toggleCampaignStatusAction.bind(null, c.id, c.status)}>
                          <SubmitButton variant="ghost" size="sm">
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
        </Card>
      )}
    </div>
  )
}

function AdStat({
  label,
  value,
  icon: Icon,
  sub,
  accent = false,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  sub: string
  accent?: boolean
}) {
  return (
    <Card className="p-3.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className={cn('text-xl font-display font-bold tracking-tight', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  )
}
