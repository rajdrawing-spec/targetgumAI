import { z } from 'zod'

/**
 * Shared zod schemas for `AdsProvider`'s record types (`src/lib/integrations/
 * providers.ts`), used by every ads-capable provider's Tool Registry entries
 * (Metricool, and - Phase 2 BRD Section 85 - the native Google Ads/Meta Ads
 * adapters). Extracted here (pure refactor of what `metricool/tools.ts`
 * already defined privately) so a second and third provider don't each
 * redefine the same four shapes - same reasoning as `src/lib/agents/
 * schemas.ts` extracting the shared recommendation schema off the Analytics
 * Agent when the SEO Agent needed it too (docs/DECISIONS.md).
 */

export const AdCampaignRecordSchema = z.object({
  providerCampaignId: z.string(),
  name: z.string(),
  channel: z.string(),
  status: z.string().optional(),
  budget: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

/**
 * Plain TS type mirror of the schema above, inferred via this file's own
 * ('zod', not 'zod/v4') `z` - use this type everywhere outside this file
 * rather than re-deriving `z.infer<typeof AdCampaignRecordSchema>` with a
 * different `z` import. The AI Gateway's structured-output schemas
 * (src/lib/agents/schemas.ts) use 'zod/v4'; mixing the two packages'
 * `z.infer` against a schema built with the other silently collapses to
 * `{}` (docs/DECISIONS.md) - not a subtle bug worth re-introducing at every
 * call site.
 */
export type AdCampaignRecord = z.infer<typeof AdCampaignRecordSchema>

export const AdCampaignPerformanceSchema = z.object({
  source: z.string(),
  retrievedAt: z.string(),
  period: z.string(),
  providerCampaignId: z.string(),
  spend: z.number().optional(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  ctr: z.number().optional(),
  cpc: z.number().optional(),
  cpm: z.number().optional(),
  conversions: z.number().optional(),
  conversionRate: z.number().optional(),
  cpa: z.number().optional(),
  roas: z.number().optional(),
  revenue: z.number().optional(),
  frequency: z.number().optional(),
  reach: z.number().optional(),
  raw: z.unknown(),
})

export const AdGroupRecordSchema = z.object({
  providerAdGroupId: z.string(),
  providerCampaignId: z.string(),
  name: z.string(),
})

export const AdRecordSchema = z.object({
  providerAdId: z.string(),
  providerAdGroupId: z.string(),
  name: z.string(),
})
