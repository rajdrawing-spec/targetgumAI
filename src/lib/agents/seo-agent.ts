import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import { aggregateGscRows } from '@/lib/analytics/metrics'
import type { SeoQueryRow } from '@/lib/integrations/providers'
import { executeTool } from '@/lib/tools/execute'
import type { AuthContext } from '@/lib/rbac/types'
import { registerAgent } from './registry'
import { AnalysisResultSchema } from './schemas'
import type { AnalysisResult } from './analytics-agent'

/**
 * The SEO Agent (BRD-PRD Section 25's "Later: SEO Agent" list, built now as
 * a Phase 2 item - Section 85). Deliberately its own agent rather than a
 * mode of the Marketing Analytics Agent: a focused, cheaper "just check
 * SEO" analysis (one data source, one tool call pair) rather than the
 * omnibus agent's full social/ads/GA4/GSC sweep - real value on its own
 * (BRD Section 88's "repetitive SEO research" automation target), not
 * just a subset of the general one.
 *
 * Deliberately NOT a crawler or a technical SEO auditor - BRD Section 49
 * explicitly excludes "Full SEO crawler" / "Advanced SEO systems" from
 * this build. Reads only Search Console query- and page-level performance
 * (BRD Section 36) through the already-registered `gsc.get_search_performance`
 * tool; the prompt (prompts/seo/v1.md) is explicit that it must never imply
 * it crawled or audited anything beyond that data.
 *
 * Returns the same `AnalysisResult` shape as the Marketing Analytics Agent
 * (`./schemas.ts`) so it plugs into the exact same
 * `persistRecommendations`/`routeRecommendation`/`generateReport`
 * downstream pipeline with zero changes to any of those.
 */

export const SEO_AGENT_KEY = 'seo_analysis'

export async function registerSeoAgent(): Promise<void> {
  await registerAgent({
    key: SEO_AGENT_KEY,
    name: 'SEO Agent',
    purpose:
      "Analyzes a client's Search Console query and page performance and produces evidence-based SEO findings and structured, prioritized recommendations.",
    allowedToolKeys: ['gsc.get_search_performance'],
  })
}

export interface SeoRunInput {
  ctx: AuthContext
  clientId: string
  range: { from: string; to: string }
}

async function tryGatherData(label: string, dataGaps: string[], fn: () => Promise<unknown>): Promise<unknown | null> {
  try {
    return await fn()
  } catch (error) {
    dataGaps.push(`${label}: ${error instanceof Error ? error.message : 'unknown error'}`)
    return null
  }
}

export async function runSeoAnalysis(input: SeoRunInput): Promise<AnalysisResult> {
  const { ctx, clientId, range } = input

  const context = await assembleClientContext(ctx, clientId, 'analytics') // business/marketing/competitors - same slice the Marketing Analytics Agent uses, genuinely useful here too (target audience/positioning helps judge which queries matter)

  const dataGaps: string[] = []
  const dataBlocks: string[] = []

  const queryPerformance = await tryGatherData('Search Console query performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'gsc.get_search_performance',
      clientId,
      agentKey: SEO_AGENT_KEY,
      input: { dimensions: ['query'], from: range.from, to: range.to, rowLimit: 50 },
    }),
  )
  // Metrics are aggregated only from the query-dimension call, not also the
  // page one below - both cover the same period's total traffic just
  // grouped differently, so summing both would double-count clicks/impressions.
  const metrics = queryPerformance ? aggregateGscRows(queryPerformance as SeoQueryRow[]) : []
  if (queryPerformance) dataBlocks.push(`Search Console - top queries:\n${JSON.stringify(queryPerformance, null, 2)}`)

  const pagePerformance = await tryGatherData('Search Console page performance', dataGaps, () =>
    executeTool({
      ctx,
      toolKey: 'gsc.get_search_performance',
      clientId,
      agentKey: SEO_AGENT_KEY,
      input: { dimensions: ['page'], from: range.from, to: range.to, rowLimit: 50 },
    }),
  )
  if (pagePerformance) dataBlocks.push(`Search Console - top pages:\n${JSON.stringify(pagePerformance, null, 2)}`)

  // Never spend an AI call analyzing nothing (BRD Section 56 - no fabrication).
  if (dataBlocks.length === 0) {
    return {
      summary: 'No Search Console data could be retrieved for this period - the connection is unavailable. See dataGaps.',
      recommendations: [],
      aiRunId: null,
      dataGaps,
      metrics: [],
    }
  }

  const userMessage = [
    renderContextAsText(context),
    '\n--- Search Console data for this period ---',
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
    agentKey: SEO_AGENT_KEY,
    promptCategory: 'seo',
    variables: { client_name: context.client.name },
    userMessage,
    schema: AnalysisResultSchema,
  })

  return { ...result.data, aiRunId: result.aiRunId, dataGaps, metrics }
}
