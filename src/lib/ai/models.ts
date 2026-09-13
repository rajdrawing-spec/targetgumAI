/**
 * Model selection and cost tracking for Claude (BRD-PRD Section 113: "Claude
 * is the primary AI model for MVP" - Day 4, see docs/DECISIONS.md).
 * Three tiers, never a raw model string at a call site:
 *   fast      → Claude Haiku 4.5   (cheapest, fastest)
 *   default   → Claude Sonnet 5    (balanced - most agent calls)
 *   reasoning → Claude Opus 5      (strongest reasoning)
 */

export type ModelTier = 'fast' | 'default' | 'reasoning'

export const MODEL_IDS: Record<ModelTier, string> = {
  fast: process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5-20251001',
  default: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-5',
  reasoning: process.env.ANTHROPIC_REASONING_MODEL || 'claude-opus-5',
}

/**
 * USD per 1M tokens (Anthropic first-party API pricing). No live pricing
 * API to poll - refresh this table by hand (re-consult current Anthropic
 * pricing) when it's noticed to be stale, and note the update in
 * docs/DECISIONS.md.
 */
const PRICING_PER_MILLION_TOKENS_USD: Record<ModelTier, { input: number; output: number }> = {
  fast: { input: 1.0, output: 5.0 }, // Claude Haiku 4.5
  default: { input: 2.0, output: 10.0 }, // Claude Sonnet 5
  reasoning: { input: 5.0, output: 25.0 }, // Claude Opus 5
}

/**
 * Estimated cost in integer cents (ai_runs.estimatedCostCents), rounded to
 * the nearest cent.
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
