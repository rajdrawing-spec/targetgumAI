import { z } from 'zod'

/**
 * Validated shape for each ClientBrain JSON section (BRD-PRD Section 6).
 * Every write to ClientBrain goes through one of these - never store
 * unvalidated JSON, per docs/DATA-MODEL.md's "validated JSON (Zod-checked
 * on write)" design note.
 */

export const BusinessSectionSchema = z.object({
  companyName: z.string().optional(),
  industry: z.string().optional(),
  productsServices: z.string().optional(),
  locations: z.array(z.string()).optional(),
  pricing: z.string().optional(),
  offers: z.string().optional(),
  businessModel: z.string().optional(),
  businessGoals: z.array(z.string()).optional(),
})

export const AudienceSectionSchema = z.object({
  personas: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
  demographics: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
  motivations: z.array(z.string()).optional(),
  buyingJourney: z.string().optional(),
  objections: z.array(z.string()).optional(),
})

export const BrandSectionSchema = z.object({
  voice: z.string().optional(),
  tone: z.string().optional(),
  colors: z.array(z.string()).optional(),
  fonts: z.array(z.string()).optional(),
  visualRules: z.string().optional(),
  approvedImagery: z.string().optional(),
  restrictedImagery: z.string().optional(),
  messagingRules: z.string().optional(),
})

export const MarketingSectionSchema = z.object({
  objectives: z.array(z.string()).optional(),
  kpis: z.array(z.string()).optional(),
  targetChannels: z.array(z.string()).optional(),
  monthlyBudget: z.number().nonnegative().optional(),
  campaignHistory: z.string().optional(),
  previousStrategies: z.string().optional(),
  currentPriorities: z.array(z.string()).optional(),
})

export const BRAIN_SECTION_SCHEMAS = {
  business: BusinessSectionSchema,
  audience: AudienceSectionSchema,
  brand: BrandSectionSchema,
  marketing: MarketingSectionSchema,
} as const

export type BrainSectionKey = keyof typeof BRAIN_SECTION_SCHEMAS
