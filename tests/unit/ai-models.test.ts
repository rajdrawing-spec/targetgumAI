import { describe, expect, it } from 'vitest'
import { estimateCostCents, MODEL_IDS } from '@/lib/ai/models'

describe('AI model selection & cost estimation', () => {
  it('defines a model ID for every tier', () => {
    expect(MODEL_IDS.fast).toBeTruthy()
    expect(MODEL_IDS.default).toBeTruthy()
    expect(MODEL_IDS.reasoning).toBeTruthy()
  })

  it('estimates cost proportionally to tokens for the default tier', () => {
    // default tier: $2.00/$10.00 per 1M input/output tokens
    const cents = estimateCostCents('default', 1_000_000, 1_000_000)
    expect(cents).toBe(1200) // $2 + $10 = $12.00 = 1200 cents
  })

  it('the reasoning tier costs more than the fast tier for identical usage', () => {
    const fastCost = estimateCostCents('fast', 100_000, 50_000)!
    const reasoningCost = estimateCostCents('reasoning', 100_000, 50_000)!
    expect(reasoningCost).toBeGreaterThan(fastCost)
  })

  it('returns 0 (not null) for zero token usage', () => {
    expect(estimateCostCents('default', 0, 0)).toBe(0)
  })
})
