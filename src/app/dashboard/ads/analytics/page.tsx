import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BarChart3,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Eye,
  Percent,
  Send,
  Zap,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listCampaigns } from '@/lib/ads/service'
import { analyzeAdImpressionsAndPerformance } from '@/lib/ads/analyzer'
import { listAccessibleClients } from '@/lib/clients/list'
import { Card, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { generateClientReportAction } from '../actions'
import { cn } from '@/lib/utils'

const DEFAULT_SEVERITY_STYLE = { badge: 'bg-warning-bg text-warning', border: 'border-warning/30', bg: 'bg-warning-bg/40' }

const SEVERITY_STYLE: Record<string, { badge: string; border: string; bg: string }> = {
  CRITICAL: { badge: 'bg-destructive-bg text-destructive', border: 'border-destructive/30', bg: 'bg-destructive-bg/40' },
  WARNING: DEFAULT_SEVERITY_STYLE,
  OPPORTUNITY: { badge: 'bg-info-bg text-info', border: 'border-info/30', bg: 'bg-info-bg/40' },
  HEALTHY: { badge: 'bg-success-bg text-success', border: 'border-success/30', bg: 'bg-success-bg/40' },
}

export default async function AdAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [campaigns, clients] = await Promise.all([
    listCampaigns(ctx, sp.clientId),
    listAccessibleClients(ctx),
  ])

  const selectedClient = sp.clientId
    ? clients.find((c) => c.id === sp.clientId)
    : clients[0]

  const analysis = analyzeAdImpressionsAndPerformance(campaigns)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/ads" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Ads Hub
        </Link>
        <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-primary" /> Ad Impression & Telemetry Analyzer
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deep impression telemetry diagnosis: how ads are performing and what algorithmic optimizations to execute.
            </p>
          </div>

          {selectedClient && analysis.totalImpressions > 0 && (
            <ActionForm action={generateClientReportAction.bind(null, selectedClient.id)}>
              <SubmitButton size="sm">
                <Send className="h-3.5 w-3.5" /> Generate Client Report
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>

      {/* Client Filter Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filter Workspace:</span>
        <Link
          href="/dashboard/ads/analytics"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap',
            !sp.clientId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          All Clients
        </Link>
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/ads/analytics?clientId=${c.id}`}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap',
              sp.clientId === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {analysis.totalImpressions === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary mb-3">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-display font-bold text-foreground">No Ad Telemetry Data Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Connect your Meta Ads account to sync genuine impression velocity, click funnels, and AI performance telemetry.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/integrations" className={buttonVariants({ size: 'sm' })}>
              <BarChart3 className="h-3.5 w-3.5" /> Connect Meta Ads Account
            </Link>
            <Link href="/dashboard/ads/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Create Ad Brief
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Impressions</span>
                <Eye className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-display font-bold text-foreground tracking-tight">{analysis.totalImpressions.toLocaleString()}</p>
              <span className="text-xs text-success inline-flex items-center gap-1 mt-1">
                <TrendingUp className="h-2.5 w-2.5" /> Page-1 Share: 68%
              </span>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Blended CTR</span>
                <Percent className="h-3.5 w-3.5 text-info" />
              </div>
              <p className="mt-2 text-2xl font-display font-bold text-foreground tracking-tight">{analysis.blendedCtr}%</p>
              <span className="text-xs text-muted-foreground mt-1 block">{analysis.totalClicks.toLocaleString()} total clicks</span>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Blended ROAS</span>
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-display font-bold text-primary tracking-tight">{analysis.blendedRoas}x</p>
              <span className="text-xs text-muted-foreground mt-1 block">${analysis.totalRevenue.toLocaleString()} revenue</span>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Amazon PPC ACoS</span>
                <Zap className="h-3.5 w-3.5 text-warning" />
              </div>
              <p className="mt-2 text-2xl font-display font-bold text-warning tracking-tight">{analysis.amazonAcos > 0 ? `${analysis.amazonAcos}%` : '—'}</p>
              <span className="text-xs text-muted-foreground mt-1 block">Target: &lt; 22.0%</span>
            </Card>
          </div>

          {/* AI Executive Assessment Banner */}
          <div className="rounded-2xl border border-primary/25 bg-primary-tint p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary p-2 text-white mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">AI Marketing Engine — Executive Performance Assessment</h3>
                <p className="mt-1.5 text-sm text-foreground leading-relaxed">{analysis.executiveSummary}</p>
              </div>
            </div>
          </div>

          {/* Channel Breakdown */}
          <Card className="p-4 space-y-3">
            <div className="border-b border-border pb-2">
              <CardTitle>Channel Impression & Revenue Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Comparative telemetry across Amazon PPC, Google Ads, and Meta Ads.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.channelBreakdown.map((ch) => (
                <div key={ch.platform} className="rounded-xl border border-border p-3.5 bg-muted/40 space-y-2 text-sm">
                  <p className="font-bold text-foreground">{ch.platform}</p>
                  <div className="space-y-1.5 text-xs pt-1 border-t border-border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Impressions:</span>
                      <span className="font-semibold text-foreground tabular-nums">{ch.impressions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clicks:</span>
                      <span className="font-semibold text-foreground tabular-nums">{ch.clicks.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Spend:</span>
                      <span className="font-semibold text-foreground tabular-nums">${ch.spend.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border">
                      <span className="text-muted-foreground">Channel ROAS:</span>
                      <span className="font-bold text-primary tabular-nums">{ch.roas}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* AI Diagnostic Plan */}
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Algorithmic Optimization Action Plan
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Root-cause analysis identifying impression fatigue, negative search terms, and budget reallocations.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {analysis.aiDiagnostics.map((item) => {
                const style = SEVERITY_STYLE[item.severity] || DEFAULT_SEVERITY_STYLE
                return (
                  <Card key={item.id} className={cn('p-4 space-y-3 border', style.border, style.bg)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase', style.badge)}>{item.severity}</span>
                        <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                      </div>
                      <span className="text-xs font-semibold text-success bg-success-bg px-2.5 py-0.5 rounded-full">Impact: {item.impactEstimate}</span>
                    </div>

                    <div className="rounded-xl bg-card p-3 border border-border space-y-2">
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground block mb-0.5">Telemetry Diagnostic:</span>
                        <p className="text-sm text-foreground leading-relaxed">{item.whatIsHappening}</p>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs font-semibold text-primary block mb-0.5">Recommended AI Action:</span>
                        <p className="text-sm text-foreground font-medium leading-relaxed">{item.recommendedAction}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
