import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BarChart3,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Eye,
  Percent,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Send,
  Zap,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listCampaigns } from '@/lib/ads/service'
import { analyzeAdImpressionsAndPerformance } from '@/lib/ads/analyzer'
import { listAccessibleClients } from '@/lib/clients/list'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { generateClientReportAction, seedDemoAdsAction } from '../actions'
import { cn } from '@/lib/utils'

const DEFAULT_SEVERITY_STYLE = {
  badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  border: 'border-amber-500/30',
  bg: 'bg-amber-500/10',
}

const SEVERITY_STYLE: Record<string, { badge: string; border: string; bg: string }> = {
  CRITICAL: {
    badge: 'bg-[#E5252A]/20 text-[#FF4D4F] border border-[#E5252A]/40',
    border: 'border-[#E5252A]/40',
    bg: 'bg-[#E5252A]/10',
  },
  WARNING: DEFAULT_SEVERITY_STYLE,
  OPPORTUNITY: {
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
  },
  HEALTHY: {
    badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
  },
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
        <Link
          href="/dashboard/ads"
          className="inline-flex items-center gap-1.5 font-mono-data text-xs text-[#A1A1AA] hover:text-[#FFFFFF] mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Ads Hub
        </Link>
        <div className="terminal-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono-data text-[10px] text-[#A1A1AA] mb-1">
              <span className="font-semibold text-[#E5252A]">TELEMETRY DIAGNOSTICS</span>
              <span>•</span>
              <span>AI ROOT-CAUSE ENGINE</span>
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight text-[#FFFFFF] flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-[#E5252A]" /> Ad Impression & Telemetry Analyzer
            </h1>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Deep impression telemetry diagnosis: how ads are performing and what algorithmic optimizations to execute.
            </p>
          </div>

          {selectedClient && analysis.totalImpressions > 0 && (
            <ActionForm action={generateClientReportAction.bind(null, selectedClient.id)}>
              <SubmitButton className="gap-2 shadow-sm font-semibold btn-brand px-3.5 py-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Generate Client Report
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {/* Client Filter Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#27272A]">
        <span className="font-mono-data text-xs text-[#71717A] whitespace-nowrap">Filter Workspace:</span>
        <Link
          href="/dashboard/ads/analytics"
          className={cn(
            'rounded px-3 py-1 font-mono-data text-xs transition-all whitespace-nowrap',
            !sp.clientId
              ? 'bg-[#18181C] text-white font-semibold border border-[#E5252A]'
              : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
          )}
        >
          All Clients
        </Link>
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/ads/analytics?clientId=${c.id}`}
            className={cn(
              'rounded px-3 py-1 font-mono-data text-xs transition-all whitespace-nowrap',
              sp.clientId === c.id
                ? 'bg-[#18181C] text-white font-semibold border border-[#E5252A]'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {analysis.totalImpressions === 0 ? (
        <div className="terminal-panel p-8 text-center border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E5252A]/20 text-[#E5252A] mb-3">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-display font-semibold text-[#FFFFFF]">
            No Ad Telemetry Data Found
          </h3>
          <p className="text-xs text-[#A1A1AA] max-w-md mx-auto mt-1 mb-4">
            Create an ad set or load demo campaigns to simulate live impression trends, click funnels, and AI performance diagnostics.
          </p>
          <ActionForm action={seedDemoAdsAction.bind(null, selectedClient?.id)}>
            <SubmitButton className="btn-brand text-xs gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Populate Demo Ad Impressions
            </SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <>
          {/* Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="terminal-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
                  Total Impressions
                </span>
                <Eye className="h-3.5 w-3.5 text-[#E5252A]" />
              </div>
              <p className="mt-2 text-2xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
                {analysis.totalImpressions.toLocaleString()}
              </p>
              <span className="text-[10px] font-mono-data text-emerald-400 inline-flex items-center gap-1 mt-1">
                <TrendingUp className="h-2.5 w-2.5" /> Page-1 Share: 68%
              </span>
            </div>

            <div className="terminal-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
                  Blended CTR
                </span>
                <Percent className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <p className="mt-2 text-2xl font-mono-data font-bold text-[#FFFFFF] tracking-tight">
                {analysis.blendedCtr}%
              </p>
              <span className="text-[10px] font-mono-data text-[#A1A1AA] mt-1 block">
                {analysis.totalClicks.toLocaleString()} total clicks
              </span>
            </div>

            <div className="terminal-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
                  Blended ROAS
                </span>
                <TrendingUp className="h-3.5 w-3.5 text-[#E5252A]" />
              </div>
              <p className="mt-2 text-2xl font-mono-data font-bold text-[#E5252A] tracking-tight">
                {analysis.blendedRoas}x
              </p>
              <span className="text-[10px] font-mono-data text-[#A1A1AA] mt-1 block">
                ${analysis.totalRevenue.toLocaleString()} revenue
              </span>
            </div>

            <div className="terminal-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA]">
                  Amazon PPC ACoS
                </span>
                <Zap className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-mono-data font-bold text-amber-300 tracking-tight">
                {analysis.amazonAcos > 0 ? `${analysis.amazonAcos}%` : '—'}
              </p>
              <span className="text-[10px] font-mono-data text-[#A1A1AA] mt-1 block">
                Target: &lt; 22.0%
              </span>
            </div>
          </div>

          {/* AI Executive Assessment Banner */}
          <div className="rounded border border-[#E5252A]/40 bg-gradient-to-r from-[#18181C] via-[#141418] to-[#18181C] p-5">
            <div className="flex items-start gap-3">
              <div className="rounded bg-[#E5252A] p-2 text-white shadow-sm mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-mono-data font-bold text-[#FFFFFF] uppercase tracking-wider">
                  AI Marketing Engine — Executive Performance Assessment
                </h3>
                <p className="mt-1.5 text-xs text-[#F4F4F6] leading-relaxed">
                  {analysis.executiveSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Channel Breakdown */}
          <div className="terminal-card p-4 space-y-3">
            <div className="border-b border-[#27272A] pb-2">
              <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
                Channel Impression & Revenue Breakdown
              </h3>
              <p className="text-[10px] font-mono-data text-[#A1A1AA]">
                Comparative telemetry across Amazon PPC, Google Ads, and Meta Ads.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.channelBreakdown.map((ch) => (
                <div key={ch.platform} className="rounded border border-[#27272A] p-3.5 bg-[#18181C] space-y-2 font-mono-data text-xs">
                  <p className="font-bold text-[#FFFFFF]">{ch.platform}</p>
                  <div className="space-y-1.5 text-[11px] pt-1 border-t border-[#27272A]">
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA]">Impressions:</span>
                      <span className="font-semibold text-white">{ch.impressions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA]">Clicks:</span>
                      <span className="font-semibold text-white">{ch.clicks.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA]">Total Spend:</span>
                      <span className="font-semibold text-white">${ch.spend.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#27272A]">
                      <span className="text-[#A1A1AA]">Channel ROAS:</span>
                      <span className="font-bold text-[#E5252A]">{ch.roas}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Diagnostic Plan */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#E5252A]" /> Algorithmic Optimization Action Plan
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Root-cause analysis identifying impression fatigue, negative search terms, and budget reallocations.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {analysis.aiDiagnostics.map((item) => {
                const style = SEVERITY_STYLE[item.severity] || DEFAULT_SEVERITY_STYLE
                return (
                  <div key={item.id} className={`terminal-card p-4 border ${style.border} ${style.bg} space-y-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono-data font-bold uppercase ${style.badge}`}>
                          {item.severity}
                        </span>
                        <h4 className="text-xs font-semibold text-[#FFFFFF]">{item.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono-data font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                        Impact: {item.impactEstimate}
                      </span>
                    </div>

                    <div className="rounded bg-[#121215] p-3 border border-[#27272A] space-y-2">
                      <div>
                        <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#A1A1AA] block mb-0.5">
                          Telemetry Diagnostic:
                        </span>
                        <p className="text-xs text-[#F4F4F6] leading-relaxed">{item.whatIsHappening}</p>
                      </div>
                      <div className="pt-2 border-t border-[#27272A]">
                        <span className="text-[10px] font-mono-data uppercase tracking-wider text-[#E5252A] block mb-0.5">
                          Recommended AI Action:
                        </span>
                        <p className="text-xs text-[#FFFFFF] font-medium leading-relaxed">{item.recommendedAction}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
