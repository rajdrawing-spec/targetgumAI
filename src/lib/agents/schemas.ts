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
