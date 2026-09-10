/**
 * Model selection and cost tracking (BRD-PRD Section 11 "Model selection",
 * Section 73 "Use cheaper/faster models where appropriate and reserve
 * stronger reasoning models for tasks that benefit from them").
 *
 * Deliberately NOT hardcoded to a single model everywhere - this is a
 * multi-tenant product processing routine analysis for many clients, where
 * per-run cost adds up, unlike a one-off task. Callers pick a tier; the
 * gateway resolves it to a concrete model ID here, in one place.
 */

export type ModelTier = 'fast' | 'default' | 'reasoning'

export const MODEL_IDS: Record<ModelTier, string> = {
  fast: 'claude-haiku-4-5-20251001',
  default: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-5',
  reasoning: 'claude-opus-5',
}

/**
 * USD per 1M tokens. Keyed by tier, not by parsing the model ID string, so a
 * model-ID change above doesn't silently break cost tracking. Update this
 * alongside MODEL_IDS if a tier's underlying model changes - see
 * docs/DECISIONS.md for the source of these figures and how to refresh them.
 */
const PRICING_PER_MILLION_TOKENS_USD: Record<ModelTier, { input: number; output: number }> = {
  fast: { input: 1.0, output: 5.0 },
  default: { input: 2.0, output: 10.0 },
  reasoning: { input: 5.0, output: 25.0 },
}

/**
 * Estimated cost in integer cents (ai_runs.estimatedCostCents), rounded to
 * the nearest cent. Returns null if the tier's pricing isn't known - never
 * fabricate a cost figure (BRD Section 56's "do not fabricate data" applies
 * here too).
 */
export function estimateCostCents(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = PRICING_PER_MILLION_TOKENS_USD[tier]
  if (!pricing) return null

  const costUsd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
  return Math.round(costUsd * 100)
}
