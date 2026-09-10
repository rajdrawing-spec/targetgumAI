import { describe, expect, it } from 'vitest'
import {
  AudienceSectionSchema,
  BrandSectionSchema,
  BusinessSectionSchema,
  MarketingSectionSchema,
} from '@/lib/clients/brain-schemas'

describe('ClientBrain section schemas (BRD Section 6)', () => {
  it('BusinessSectionSchema accepts a valid partial object', () => {
    const result = BusinessSectionSchema.safeParse({
      companyName: 'Acme',
      industry: 'Retail',
      businessGoals: ['Grow revenue 20%'],
    })
    expect(result.success).toBe(true)
  })

  it('BusinessSectionSchema accepts an empty object (every field optional)', () => {
    expect(BusinessSectionSchema.safeParse({}).success).toBe(true)
  })

  it('BusinessSectionSchema rejects the wrong type for a known field', () => {
    expect(BusinessSectionSchema.safeParse({ companyName: 12345 }).success).toBe(false)
  })

  it('AudienceSectionSchema validates persona structure', () => {
    const result = AudienceSectionSchema.safeParse({
      personas: [{ name: 'Busy Parent', description: 'Time-constrained, value-driven' }],
    })
    expect(result.success).toBe(true)
    expect(AudienceSectionSchema.safeParse({ personas: [{ description: 'missing name' }] }).success).toBe(
      false,
    )
  })

  it('BrandSectionSchema accepts brand voice/colors/fonts', () => {
    const result = BrandSectionSchema.safeParse({
      voice: 'Friendly and direct',
      colors: ['#FF5733', '#333333'],
      fonts: ['Inter'],
    })
    expect(result.success).toBe(true)
  })

  it('MarketingSectionSchema rejects a negative budget', () => {
    expect(MarketingSectionSchema.safeParse({ monthlyBudget: -100 }).success).toBe(false)
    expect(MarketingSectionSchema.safeParse({ monthlyBudget: 5000 }).success).toBe(true)
  })
})
