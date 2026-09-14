import type { z } from 'zod/v4'
import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import { aggregateAdPerformance, aggregateGa4Report, aggregateGscRows, aggregateSocialMetrics } from '@/lib/analytics/metrics'
import type { MetricSnapshotInput } from '@/lib/analytics/metrics'
import type { AdCampaignPerformance, AnalyticsReportRow, SeoQueryRow, SocialMetricValue } from '@/lib/integrations/providers'
import { executeTool } from '@/lib/tools/execute'
import type { AuthContext } from '@/lib/rbac/types'
import { registerAgent } from './registry'
import { AnalysisResultSchema, RecommendationSchema } from './schemas'

/**
 * The Marketing Analytics Agent (BRD-PRD Section 25.3): analyzes a
 * client's ads, social, GA4, and Search Console data and produces
 * evidence-based findings + structured recommendations (Section 39). The
 * first real agent - ties together the AI Gateway (Day 4), the Tool
 * Registry (Day 5), the Metricool/GA4/GSC providers (Days 6-7), and the
 * Context Router (Day 8).
 *
 * Read-only by construction: every tool in its allowlist is LOW risk. BRD
 * Section 19: "No campaign modification should occur merely because
 * Claude recommends it" - this agent cannot execute anything, only
 * analyze and recommend. Turning a recommendation into an executed action
 * is Day 10's Approval Engine, not this agent.
 */

export const MARKETING_ANALYTICS_AGENT_KEY = 'marketing_analytics'

export async function registerMarketingAnalyticsAgent(): Promise<void> {
  await registerAgent({
    key: MARKETING_ANALYTICS_AGENT_KEY,
    name: 'Marketing Analytics Agent',
    purpose:
      "Analyzes a client's social, ads, GA4, and Search Console performance and produces evidence-based findings and structured, prioritized recommendations.",
    allowedToolKeys: [
      'metricool.get_social_analytics',
      'metricool.get_ad_campaigns',
      'metricool.get_ad_performance',
      'meta_ads.get_campaigns',
      'meta_ads.get_campaign_performance',
      'google_ads.get_campaigns',
      'google_ads.get_campaign_performance',
      'amazon_ads.get_campaigns',
      'amazon_ads.get_campaign_performance',
      'ga4.get_report',
      'gsc.get_search_performance',
    ],
  })
}

// --- Structured output schema (BRD Section 39/71) ---
// Shared with every other analysis agent (./schemas.ts) - see that file's
// doc comment for why.

export interface AnalyticsRunInput {
  ctx: AuthContext
  clientId: string
  range: { from: string; to: string }
  /** Explicit for now - auto-discovering every connected network/channel is a future refinement, not required to prove the pipeline works. */
  socialNetwork: string
  adsChannel: string
}

export interface AnalysisResult {
  summary: string
  recommendations: z.infer<typeof RecommendationSchema>[]
  /** null when no AI call was made at all - see the "every data source failed" guard below. */
  aiRunId: string | null
  /** Integrations that failed or had no connection - never silently omitted, per BRD Section 56 (no fabricated data). */
  dataGaps: string[]
  /** Validated, aggregated per-metric values from the gathered data (src/lib/analytics/metrics.ts) - what src/lib/reports/generate.ts persists as AnalyticsSnapshot rows and compares period-over-period. Never derived from anything Claude said. */
  metrics: MetricSnapshotInput[]
}

async function tryGatherData(
  label: string,
  dataGaps: string[],
  fn: () => Promise<unknown>,
): Promise<unknown | null> {
  try {
    return await fn()
  } catch (error) {
    dataGaps.push(`${label}: ${error instanceof Error ? error.message : 'unknown error'}`)
    return null
  }
}

/**
 * Runs the full analytics workflow: Context Router → gather real-time data
 * (tolerating individual integration failures as documented gaps, not
 * aborting the whole run) → Claude analysis via the AI Gateway → structured
 * findings/recommendations. Nothing here is persisted - Day 10 wires
 * results into the `recommendations` table, tasks, and the approval flow.
 */
export async function runMarketingAnalysis(input: AnalyticsRunInput): Promise<AnalysisResult> {
  const { ctx, clientId, range } = input

  const context = await assembleClientContext(ctx, clientId, 'analytics')

  const dataGaps: string[] = []
  const dataBlocks: string[] = []
  const metrics: MetricSnapshotInput[] = []

  const socialAnalytics = await tryGatherData('Metricool social analytics', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'metricool.get_social_analytics',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { network: input.socialNetwork, ...range },
    }),
  )
  if (socialAnalytics) {
    dataBlocks.push(`Social analytics (${input.socialNetwork}):\n${JSON.stringify(socialAnalytics, null, 2)}`)
    metrics.push(...aggregateSocialMetrics(socialAnalytics as SocialMetricValue[]))
  }

  const adCampaigns = await tryGatherData('Metricool ad campaigns', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'metricool.get_ad_campaigns',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { channel: input.adsChannel },
    }),
  )
  if (adCampaigns) dataBlocks.push(`Ad campaigns (${input.adsChannel}):\n${JSON.stringify(adCampaigns, null, 2)}`)

  const adPerformance = await tryGatherData('Metricool ad performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'metricool.get_ad_performance',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { channel: input.adsChannel, ...range },
    }),
  )
  if (adPerformance) {
    dataBlocks.push(`Ad performance (${input.adsChannel}):\n${JSON.stringify(adPerformance, null, 2)}`)
    metrics.push(...aggregateAdPerformance(adPerformance as AdCampaignPerformance[]))
  }

  const metaCampaigns = await tryGatherData('Meta Ads campaigns', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'meta_ads.get_campaigns',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: {},
    }),
  )
  if (metaCampaigns) dataBlocks.push(`Meta Ads campaigns:\n${JSON.stringify(metaCampaigns, null, 2)}`)

  const metaPerformance = await tryGatherData('Meta Ads performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'meta_ads.get_campaign_performance',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { from: range.from, to: range.to },
    }),
  )
  if (metaPerformance) {
    dataBlocks.push(`Meta Ads performance:\n${JSON.stringify(metaPerformance, null, 2)}`)
    metrics.push(...aggregateAdPerformance(metaPerformance as AdCampaignPerformance[]))
  }

  const googleAdsCampaigns = await tryGatherData('Google Ads campaigns', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'google_ads.get_campaigns',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: {},
    }),
  )
  if (googleAdsCampaigns) dataBlocks.push(`Google Ads campaigns:\n${JSON.stringify(googleAdsCampaigns, null, 2)}`)

  const googleAdsPerformance = await tryGatherData('Google Ads performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'google_ads.get_campaign_performance',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { from: range.from, to: range.to },
    }),
  )
  if (googleAdsPerformance) {
    dataBlocks.push(`Google Ads performance:\n${JSON.stringify(googleAdsPerformance, null, 2)}`)
    metrics.push(...aggregateAdPerformance(googleAdsPerformance as AdCampaignPerformance[]))
  }

  const amazonAdsCampaigns = await tryGatherData('Amazon Ads campaigns', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'amazon_ads.get_campaigns',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: {},
    }),
  )
  if (amazonAdsCampaigns) dataBlocks.push(`Amazon Ads campaigns:\n${JSON.stringify(amazonAdsCampaigns, null, 2)}`)

  const amazonAdsPerformance = await tryGatherData('Amazon Ads performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'amazon_ads.get_campaign_performance',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { from: range.from, to: range.to },
    }),
  )
  if (amazonAdsPerformance) {
    dataBlocks.push(`Amazon Ads performance:\n${JSON.stringify(amazonAdsPerformance, null, 2)}`)
    metrics.push(...aggregateAdPerformance(amazonAdsPerformance as AdCampaignPerformance[]))
  }

  const ga4Report = await tryGatherData('GA4 report', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'ga4.get_report',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: {
        dimensions: ['sessionDefaultChannelGroup'],
        metrics: ['sessions', 'conversions', 'totalRevenue'],
        from: range.from,
        to: range.to,
      },
    }),
  )
  if (ga4Report) {
    dataBlocks.push(`GA4 report:\n${JSON.stringify(ga4Report, null, 2)}`)
    metrics.push(...aggregateGa4Report(ga4Report as AnalyticsReportRow[]))
  }

  const gscPerformance = await tryGatherData('Search Console performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'gsc.get_search_performance',
      clientId,
      agentKey: MARKETING_ANALYTICS_AGENT_KEY,
      input: { dimensions: ['query'], from: range.from, to: range.to },
    }),
  )
  if (gscPerformance) {
    dataBlocks.push(`Search Console performance:\n${JSON.stringify(gscPerformance, null, 2)}`)
    metrics.push(...aggregateGscRows(gscPerformance as SeoQueryRow[]))
  }

  // Never spend an AI call analyzing nothing - and never let Claude "analyze"
  // an input with no real data, which invites exactly the fabrication BRD
  // Section 56 forbids.
  if (dataBlocks.length === 0) {
    return {
      summary: 'No performance data could be retrieved for this period - every connected data source failed or is unavailable. See dataGaps.',
      recommendations: [],
      aiRunId: null,
      dataGaps,
      metrics: [],
    }
  }

  const userMessage = [
    renderContextAsText(context),
    '\n--- Performance data for this period ---',
    ...dataBlocks,
    dataGaps.length > 0
      ? `\n--- Data unavailable (report as gaps, never invent replacement values) ---\n${dataGaps.join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await runStructuredAiTask({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    agentKey: MARKETING_ANALYTICS_AGENT_KEY,
    promptCategory: 'analytics',
    variables: { client_name: context.client.name },
    userMessage,
    schema: AnalysisResultSchema,
  })

  return { ...result.data, aiRunId: result.aiRunId, dataGaps, metrics }
}
