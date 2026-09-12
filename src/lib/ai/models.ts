/**
 * Model selection and cost tracking for Google Gemini.
 * Three tiers mapping to Gemini model families:
 *   fast      → gemini-2.0-flash-lite  (cheapest, fastest, free tier)
 *   default   → gemini-2.0-flash       (balanced — free tier)
 *   reasoning → gemini-2.5-pro         (strongest reasoning)
 */

export type ModelTier = 'fast' | 'default' | 'reasoning'

export const MODEL_IDS: Record<ModelTier, string> = {
  fast: process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite',
  default: process.env.GEMINI_DEFAULT_MODEL || 'gemini-3.6-flash',
  reasoning: process.env.GEMINI_REASONING_MODEL || 'gemini-3.6-flash',
}

/**
 * USD per 1M tokens for Gemini models (approximate, as of mid-2026).
 * Free tier: gemini-2.0-flash and flash-lite are free up to daily quotas.
 * Update if pricing changes: https://ai.google.dev/pricing
 */
const PRICING_PER_MILLION_TOKENS_USD: Record<ModelTier, { input: number; output: number }> = {
  fast: { input: 0.0, output: 0.0 },      // Free tier
  default: { input: 0.0, output: 0.0 },   // Free tier
  reasoning: { input: 1.25, output: 10.0 }, // gemini-2.5-pro paid
}

/**
 * Estimated cost in integer cents (ai_runs.estimatedCostCents), rounded to
 * the nearest cent. Returns 0 for free-tier models.
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
