import { z } from 'zod/v4'

/**
 * The structured-output shape every analysis agent produces (BRD Section
 * 39/71's Recommendation fields), shared so `reports/generate.ts`'s
 * `AnalysisResult` type and `recommendations/persist.ts`'s
 * `RecommendationInput` stay structurally identical no matter which agent
 * produced the data - a report or a persisted recommendation doesn't (and
 * shouldn't) know or care whether it came from the Marketing Analytics
 * Agent or the SEO Agent. zod/v4, not classic 'zod' - required by the AI
 * Gateway's structured outputs (src/lib/ai/gateway.ts), see docs/DECISIONS.md.
 */
export const RecommendationSchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  area: z.string().describe('e.g. "Google Ads", "Instagram", "SEO"'),
  finding: z.string().describe('What was observed, grounded in the evidence given'),
  evidence: z.array(z.string()).describe('Specific numbers/facts from the provided data that support this finding'),
  likelyCause: z.string().optional().describe('State as a hypothesis, not a certainty, when causality is uncertain'),
  recommendation: z.string(),
  expectedImpact: z.string().optional(),
  confidence: z.number().min(0).max(1),
  requiresApproval: z
    .boolean()
    .describe('true for anything beyond reporting/analysis - agents never execute actions themselves'),
})

export const AnalysisResultSchema = z.object({
  summary: z.string().describe('A short (2-4 sentence) plain-language summary of what matters most'),
  recommendations: z.array(RecommendationSchema),
})

/**
 * A concrete, executable next step (Phase 3 of the automation roadmap -
 * "agents that propose real actions, not just findings"). Marketing
 * Analytics Agent-only - NOT part of the shared `AnalysisResultSchema`
 * above, which stays exactly as it was for the Competitor and SEO agents
 * (neither produces anything executable). See
 * `AnalyticsAnalysisResultSchema` below and
 * `src/lib/automation/dispatch-proposed-actions.ts`.
 *
 * This still never executes anything itself - BRD Section 19 ("No campaign
 * modification should occur merely because Claude recommends it") holds
 * exactly as it does for `RecommendationSchema`. What changes is that the
 * proposal is now machine-shaped (a real provider + campaign id + tool
 * action) instead of only prose, so the deterministic orchestrator in
 * `dispatch-proposed-actions.ts` - never Claude - can decide, from the
 * client's own `automationLevel`/`ClientPolicy`, whether to turn it into a
 * pending Approval or (only where policy explicitly allows it) an
 * immediate MEDIUM-risk tool execution. HIGH-risk actions always still go
 * through the normal Approval Engine gate (src/lib/tools/execute.ts) no
 * matter what.
 */
export const ProposedActionSchema = z.object({
  provider: z.enum(['META_ADS', 'GOOGLE_ADS', 'AMAZON_ADS']).describe('Which connected ad platform this campaign belongs to'),
  action: z.enum(['PAUSE_CAMPAIGN', 'UPDATE_BUDGET']),
  providerCampaignId: z
    .string()
    .describe('The exact campaign id copied verbatim from the campaign data given to you above - never invent, guess, or paraphrase one'),
  campaignName: z.string().describe('For a human-readable summary only - not used to look anything up'),
  newBudget: z
    .number()
    .positive()
    .optional()
    .describe('Required only when action is UPDATE_BUDGET: the new total daily budget, never a delta or a percentage'),
  reasoning: z.string().describe('Why this specific action, grounded in the same evidence as the related recommendation'),
  relatedRecommendationIndex: z
    .number()
    .int()
    .min(0)
    .describe("Index into this response's recommendations array - the finding this action carries out"),
})

export type ProposedAction = z.infer<typeof ProposedActionSchema>

/**
 * `AnalysisResultSchema` + `proposedActions` - the Marketing Analytics
 * Agent's own output shape (src/lib/agents/analytics-agent.ts), not shared
 * with the Competitor or SEO agents.
 */
export const AnalyticsAnalysisResultSchema = AnalysisResultSchema.extend({
  proposedActions: z
    .array(ProposedActionSchema)
    .describe(
      'Concrete, executable next steps - never fabricated. Every entry must reference a real campaign id copied verbatim from the campaign data given to you, and its relatedRecommendationIndex must point at one of the recommendations above. Leave this empty if no safe, well-evidenced action can be proposed from the data - do not force one just to fill the array. These are still only proposals: TargetGum decides, from this client\'s own automation settings, whether and how each one actually runs - never assume any of them will execute.',
    ),
})
