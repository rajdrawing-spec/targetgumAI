import type { GrowthMissionCadence } from '@prisma/client'

/**
 * The Marketing Quests catalog (docs/DECISIONS.md 2026-09-24). Every quest
 * is a real marketing action, never an engagement-for-its-own-sake task.
 *
 * `verified: true` quests complete from real records - the server counts
 * the actual rows (lessons, creatives, campaigns, connections, analysis
 * runs; see quests.ts) and only then lets the XP be claimed. They can
 * never be self-reported. `verified: false` quests are the original
 * self-reported missions (2026-09-22), kept working exactly as before.
 *
 * Zero-dependency on purpose: missions.ts (catalog sync + the
 * self-report guard) and quests.ts (verifiers + claim) both need this
 * list, and quests.ts imports missions.ts.
 *
 * Rows are inserted into `growth_missions` only when missing, so an
 * edited title/XP in the database is never overwritten by this file.
 */
export interface QuestDef {
  key: string
  cadence: GrowthMissionCadence
  title: string
  description: string
  xpReward: number
  targetCount: number
  verified: boolean
  icon: 'audience' | 'analytics' | 'creative' | 'lesson' | 'campaign' | 'integration' | 'map' | 'goal'
}

export const QUEST_DEFS: readonly QuestDef[] = [
  // --- Original self-reported missions (seeded 2026-09-22) ---
  {
    key: 'find-3-audience-segments',
    cadence: 'DAILY',
    title: 'Find 3 high-intent audience segments',
    description: 'Use Audience Lab to identify segments worth targeting today.',
    xpReward: 100,
    targetCount: 3,
    verified: false,
    icon: 'audience',
  },
  {
    key: 'review-campaign-performance',
    cadence: 'DAILY',
    title: 'Review a campaign’s performance',
    description: 'Open Analytics and check in on at least one live campaign.',
    xpReward: 50,
    targetCount: 1,
    verified: false,
    icon: 'analytics',
  },
  {
    key: 'audit-creative-library',
    cadence: 'WEEKLY',
    title: 'Audit your creative library',
    description: 'Review Creative Studio assets and retire anything stale.',
    xpReward: 150,
    targetCount: 1,
    verified: false,
    icon: 'creative',
  },
  // --- Verified quests ---
  {
    key: 'complete-a-lesson',
    cadence: 'DAILY',
    title: 'Complete a marketing lesson',
    description: 'Finish the next stage on the Growth Map.',
    xpReward: 50,
    targetCount: 1,
    verified: true,
    icon: 'lesson',
  },
  {
    key: 'create-3-creatives',
    cadence: 'WEEKLY',
    title: 'Create 3 ad creatives',
    description: 'Generate three ad creatives in Creative Studio this week.',
    xpReward: 150,
    targetCount: 3,
    verified: true,
    icon: 'creative',
  },
  {
    key: 'run-marketing-analysis',
    cadence: 'WEEKLY',
    title: 'Analyze your marketing',
    description: 'Run an AI analysis from the client Overview this week.',
    xpReward: 100,
    targetCount: 1,
    verified: true,
    icon: 'analytics',
  },
  {
    // The reference's "Weekly Goal" and the brief's weekly-challenge bonus
    // XP: counts the other quests actually completed this week.
    key: 'weekly-goal',
    cadence: 'WEEKLY',
    title: 'Weekly goal: complete 7 quests',
    description: 'Finish any 7 quests this week for a bonus.',
    xpReward: 150,
    targetCount: 7,
    verified: true,
    icon: 'goal',
  },
  {
    key: 'launch-first-campaign',
    cadence: 'SPECIAL',
    title: 'Create your first ad campaign',
    description: 'Use the guided campaign builder to set up a real campaign.',
    xpReward: 250,
    targetCount: 1,
    verified: true,
    icon: 'campaign',
  },
  {
    key: 'connect-first-integration',
    cadence: 'SPECIAL',
    title: 'Connect your first account',
    description: 'Connect an ads, social or analytics account so TargetGum can use real data.',
    xpReward: 150,
    targetCount: 1,
    verified: true,
    icon: 'integration',
  },
  {
    key: 'finish-five-stages',
    cadence: 'SPECIAL',
    title: 'Reach stage 5 of the Growth Map',
    description: 'Complete five Growth Map stages.',
    xpReward: 200,
    targetCount: 5,
    verified: true,
    icon: 'map',
  },
]

export const VERIFIED_QUEST_KEYS: ReadonlySet<string> = new Set(QUEST_DEFS.filter((q) => q.verified).map((q) => q.key))

export function getQuestDef(key: string): QuestDef | undefined {
  return QUEST_DEFS.find((q) => q.key === key)
}
