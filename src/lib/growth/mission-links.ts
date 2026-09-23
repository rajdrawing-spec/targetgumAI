/**
 * Growth Map mission -> real feature screen, so "Start Mission" deep-links
 * into the actual tool instead of duplicating it (docs/DECISIONS.md
 * 2026-09-22, "Start Mission buttons deep-link into real existing
 * screens... rather than duplicating them"). Keyed by `GrowthMission.key`
 * (seeded platform content, not a fixed enum - see prisma/seed.ts) rather
 * than exhaustively typed, since a future mission added only in the
 * database shouldn't require a code change just to render without a link.
 */
export const MISSION_SCREEN_LINKS: Record<string, { label: string; href: (clientId: string) => string }> = {
  'find-3-audience-segments': {
    label: 'Open Audience profile',
    href: (clientId) => `/dashboard/clients/${clientId}/audience`,
  },
  'review-campaign-performance': {
    label: 'Open Ad Analytics',
    href: (clientId) => `/dashboard/ads/analytics?clientId=${clientId}`,
  },
  'audit-creative-library': {
    label: 'Open Creative Studio',
    href: (clientId) => `/dashboard/creatives?clientId=${clientId}`,
  },
}
