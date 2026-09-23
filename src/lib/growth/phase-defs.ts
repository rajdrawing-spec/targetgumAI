import type { GrowthStageKey } from '@prisma/client'

/**
 * Groups the 10 fixed Growth Map stages into 4 named phases, purely for
 * display - a shorter, phase-based map (docs/DECISIONS.md 2026-09-23)
 * instead of one long illustrated path with all 10 stages spelled out at
 * once. Stage order/completion logic (`stage-defs.ts`, `stages.ts`) is
 * unchanged; this is a read-only grouping layer on top of it.
 */
export interface GrowthPhaseDef {
  key: string
  order: number
  title: string
  description: string
  stageKeys: readonly GrowthStageKey[]
}

export const GROWTH_PHASE_DEFS: readonly GrowthPhaseDef[] = [
  {
    key: 'foundation',
    order: 1,
    title: 'Foundation',
    description: 'Get the fundamentals right before you spend a dollar.',
    stageKeys: ['DEFINE_BUSINESS', 'UNDERSTAND_AUDIENCE', 'RESEARCH_MARKET'],
  },
  {
    key: 'build',
    order: 2,
    title: 'Build',
    description: 'Turn research into an offer, and the assets to sell it.',
    stageKeys: ['CREATE_OFFER', 'CREATE_CREATIVE_ASSETS', 'BUILD_CAMPAIGN'],
  },
  {
    key: 'launch',
    order: 3,
    title: 'Launch',
    description: 'Go live and start reading real results.',
    stageKeys: ['LAUNCH_CAMPAIGN', 'ANALYZE_RESULTS'],
  },
  {
    key: 'grow',
    order: 4,
    title: 'Optimize & Grow',
    description: 'Sharpen what works, then scale it up.',
    stageKeys: ['OPTIMIZE', 'SCALE_GROW'],
  },
]

export type GrowthPhaseStatus = 'done' | 'current' | 'locked'

/** A phase is 'current' if it holds the client's current stage, 'done' once every stage in it is complete, else 'locked'. */
export function phaseStatus(phase: GrowthPhaseDef, stageStatusByKey: ReadonlyMap<GrowthStageKey, 'done' | 'current' | 'locked'>): GrowthPhaseStatus {
  const statuses = phase.stageKeys.map((key) => stageStatusByKey.get(key))
  if (statuses.every((s) => s === 'done')) return 'done'
  if (statuses.some((s) => s === 'current')) return 'current'
  return 'locked'
}
