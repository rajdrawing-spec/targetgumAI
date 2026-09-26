import type { GrowthStageKey } from '@prisma/client'

/**
 * The 10 fixed Growth Map stages, in order - see docs/DATA-MODEL.md
 * "Growth Map". Kept as an explicit array (rather than relying on
 * Object.values on the Prisma enum, which isn't guaranteed stable across
 * generator versions) since it also drives "what's the next stage" logic.
 *
 * Zero-dependency on purpose: both stages.ts (stage completion logic) and
 * progress.ts (XP/level/streak) need this, and progress.ts is itself
 * imported by stages.ts - keeping the shared constants in their own file
 * avoids a circular import between the two.
 */
export const GROWTH_STAGE_ORDER: readonly GrowthStageKey[] = [
  'DEFINE_BUSINESS',
  'UNDERSTAND_AUDIENCE',
  'RESEARCH_MARKET',
  'CREATE_OFFER',
  'CREATE_CREATIVE_ASSETS',
  'BUILD_CAMPAIGN',
  'LAUNCH_CAMPAIGN',
  'ANALYZE_RESULTS',
  'OPTIMIZE',
  'SCALE_GROW',
]

/** `GROWTH_STAGE_ORDER[0]`, named so callers never deal with the `| undefined` an index access would carry (noUncheckedIndexedAccess). */
export const FIRST_GROWTH_STAGE: GrowthStageKey = GROWTH_STAGE_ORDER[0]!

export interface GrowthStageDef {
  key: GrowthStageKey
  order: number
  title: string
  /** One-word label for compact progress rows (Growth Profile). */
  shortTitle: string
  description: string
}

/** Display content for the map - titles/descriptions match the approved mockup. */
export const GROWTH_STAGE_DEFS: readonly GrowthStageDef[] = [
  { key: 'DEFINE_BUSINESS', order: 1, title: 'Define Your Business', shortTitle: 'Business', description: 'Tell us about your business, goals and audience.' },
  { key: 'UNDERSTAND_AUDIENCE', order: 2, title: 'Understand Your Audience', shortTitle: 'Audience', description: 'Find and analyze your ideal customers.' },
  { key: 'RESEARCH_MARKET', order: 3, title: 'Research Your Market', shortTitle: 'Research', description: 'Discover trends and opportunities.' },
  { key: 'CREATE_OFFER', order: 4, title: 'Create Your Offer', shortTitle: 'Offer', description: 'Build an irresistible offer.' },
  { key: 'CREATE_CREATIVE_ASSETS', order: 5, title: 'Create Creative Assets', shortTitle: 'Creative', description: 'Generate high-converting visuals and copy.' },
  { key: 'BUILD_CAMPAIGN', order: 6, title: 'Build Campaign', shortTitle: 'Campaign', description: 'Set up your campaign across platforms.' },
  { key: 'LAUNCH_CAMPAIGN', order: 7, title: 'Launch Campaign', shortTitle: 'Launch', description: 'Go live and reach your audience.' },
  { key: 'ANALYZE_RESULTS', order: 8, title: 'Analyze Results', shortTitle: 'Analyze', description: 'Track performance with AI insights.' },
  { key: 'OPTIMIZE', order: 9, title: 'Optimize', shortTitle: 'Optimize', description: 'Improve and get better results.' },
  { key: 'SCALE_GROW', order: 10, title: 'Scale & Grow', shortTitle: 'Scale', description: 'Achieve bigger results and unlock new opportunities.' },
]
