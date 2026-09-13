import { describe, expect, it } from 'vitest'
import { estimateCostCents, MODEL_IDS } from '@/lib/ai/models'

describe('AI model selection & cost estimation', () => {
  it('defines a model ID for every tier', () => {
    expect(MODEL_IDS.fast).toBeTruthy()
    expect(MODEL_IDS.default).toBeTruthy()
    expect(MODEL_IDS.reasoning).toBeTruthy()
  })

  it('estimates cost proportionally to tokens for the reasoning tier', () => {
    // reasoning tier (Claude Opus 5): $5.00/$25.00 per 1M input/output tokens
    const cents = estimateCostCents('reasoning', 1_000_000, 1_000_000)
    expect(cents).toBe(3000) // $5.00 + $25.00 = $30.00 = 3000 cents
  })

  it('estimates cost proportionally to tokens for the fast tier', () => {
    // fast tier (Claude Haiku 4.5): $1.00/$5.00 per 1M input/output tokens
    const cents = estimateCostCents('fast', 1_000_000, 1_000_000)
    expect(cents).toBe(600) // $1.00 + $5.00 = $6.00 = 600 cents
  })

  it('the reasoning tier costs more than the fast tier for identical usage', () => {
    const fastCost = estimateCostCents('fast', 100_000, 50_000)!
    const reasoningCost = estimateCostCents('reasoning', 100_000, 50_000)!
    expect(reasoningCost).toBeGreaterThan(fastCost)
  })

  it('the default tier sits between fast and reasoning for identical usage', () => {
    const fastCost = estimateCostCents('fast', 100_000, 50_000)!
    const defaultCost = estimateCostCents('default', 100_000, 50_000)!
    const reasoningCost = estimateCostCents('reasoning', 100_000, 50_000)!
    expect(defaultCost).toBeGreaterThan(fastCost)
    expect(defaultCost).toBeLessThan(reasoningCost)
  })

  it('returns 0 (not null) for zero token usage', () => {
    expect(estimateCostCents('default', 0, 0)).toBe(0)
  })
})
