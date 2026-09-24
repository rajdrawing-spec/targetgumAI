import type { GrowthStageKey } from '@prisma/client'

/**
 * The "campaign bridge" (docs/DECISIONS.md 2026-09-24): after a stage's
 * lesson, "Now let's use what you learned" sends the learner into the
 * real TargetGum screen that applies it - learn -> practice -> apply.
 * Same deep-link-don't-duplicate principle as mission-links.ts.
 *
 * Resolved server-side from the stage key only (completeStageAction never
 * takes a redirect URL from the form), so this can't become an open
 * redirect.
 */
export const STAGE_BRIDGES: Record<GrowthStageKey, { label: string; href: (clientId: string) => string }> = {
  DEFINE_BUSINESS: { label: 'Review my business profile', href: (id) => `/dashboard/clients/${id}/business` },
  UNDERSTAND_AUDIENCE: { label: 'Build my audience profile', href: (id) => `/dashboard/clients/${id}/audience` },
  RESEARCH_MARKET: { label: 'Set my marketing objectives', href: (id) => `/dashboard/clients/${id}/marketing` },
  CREATE_OFFER: { label: 'Write down my offer', href: (id) => `/dashboard/clients/${id}/business` },
  CREATE_CREATIVE_ASSETS: { label: 'Open Creative Studio', href: (id) => `/dashboard/creatives?clientId=${id}` },
  BUILD_CAMPAIGN: { label: 'Build my campaign', href: (id) => `/dashboard/ads/new?clientId=${id}` },
  LAUNCH_CAMPAIGN: { label: 'Launch my campaign', href: (id) => `/dashboard/ads/new?clientId=${id}` },
  ANALYZE_RESULTS: { label: 'See my campaign results', href: (id) => `/dashboard/ads/analytics?clientId=${id}` },
  OPTIMIZE: { label: 'Review my campaign results', href: (id) => `/dashboard/ads/analytics?clientId=${id}` },
  SCALE_GROW: { label: 'Plan my next campaign', href: (id) => `/dashboard/ads/new?clientId=${id}` },
}
