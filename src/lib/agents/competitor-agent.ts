import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import type { AuthContext } from '@/lib/rbac/types'
import { registerAgent } from './registry'
import { AnalysisResultSchema } from './schemas'
import type { AnalysisResult } from './analytics-agent'

/**
 * The Competitor Agent (BRD-PRD Section 25's "Later: Competitor Agent"
 * list, built now as a Phase 2 item - Section 85). Architecturally
 * different from the Marketing Analytics/SEO agents: it has no Tool
 * Registry allowlist at all (`allowedToolKeys: []`) and makes no
 * `executeTool` calls, because there is nothing to fetch from a provider -
 * competitor data (BRD Section 5's "Competitor names, URLs, positioning,
 * relevant observations") is stored directly on the client
 * (`ClientCompetitor`, managed via `src/lib/clients/brain.ts`), not
 * pulled live from anywhere. This agent's only job is to reason over
 * that already-stored, human-entered context - never to look anything
 * up itself. BRD Section 49 ("Advanced competitive intelligence" is a
 * Phase 3 external-integration item) and Section 50's roadmap (no
 * competitor data source is scheduled before Phase 3) both rule out
 * scraping or fetching a competitor's actual site/ads here - the prompt
 * (prompts/competitor/v1.md) is explicit that it must never imply it did.
 *
 * Still registered as an Agent (BRD Section 26's Agent Contract) even
 * with an empty tool allowlist, for the same audit-attribution reason
 * every other agent is: every AiRun/recommendation it produces carries
 * `contextIds.agentKey`, so it stays traceable and consistent with how
 * every other analysis surfaces in this app.
 *
 * Returns the same `AnalysisResult` shape as every other agent
 * (`./schemas.ts`) so it plugs into the exact same
 * `persistRecommendations`/`routeRecommendation`/`generateReport`
 * downstream pipeline with zero changes to any of those. `metrics` is
 * always `[]` - there is nothing quantifiable to snapshot here, positioning
 * is qualitative by nature.
 */

export const COMPETITOR_AGENT_KEY = 'competitor_analysis'

export async function registerCompetitorAgent(): Promise<void> {
  await registerAgent({
    key: COMPETITOR_AGENT_KEY,
    name: 'Competitor Agent',
    purpose:
      "Analyzes a client's stored competitor records against their own business/marketing context and produces evidence-based positioning findings and structured, prioritized recommendations.",
    allowedToolKeys: [],
  })
}

export interface CompetitorRunInput {
  ctx: AuthContext
  clientId: string
}

export async function runCompetitorAnalysis(input: CompetitorRunInput): Promise<AnalysisResult> {
  const { ctx, clientId } = input

  const context = await assembleClientContext(ctx, clientId, 'analytics') // the only category that assembles competitors - see context-router.ts

  // Never spend an AI call analyzing nothing (BRD Section 56 - no fabrication).
  if (!context.competitors || context.competitors.length === 0) {
    return {
      summary: 'No competitors are on file for this client yet - nothing to analyze.',
      recommendations: [],
      aiRunId: null,
      dataGaps: ['No ClientCompetitor records exist for this client.'],
      metrics: [],
    }
  }

  const userMessage = [
    renderContextAsText(context),
    '\n--- Analyze the competitors listed above against this client\'s own business/marketing context ---',
  ].join('\n')

  const result = await runStructuredAiTask({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    agentKey: COMPETITOR_AGENT_KEY,
    promptCategory: 'competitor',
    variables: { client_name: context.client.name },
    userMessage,
    schema: AnalysisResultSchema,
  })

  return { ...result.data, aiRunId: result.aiRunId, dataGaps: [], metrics: [] }
}
