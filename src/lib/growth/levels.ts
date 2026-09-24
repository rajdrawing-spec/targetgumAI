import { db } from '@/lib/db/client'
import { LEVEL_XP_STEP } from './progress'

/**
 * Growth level titles ("Level 5 - Growth Marketer"). The names are
 * configurable in the database (`growth_levels`, docs/DECISIONS.md
 * 2026-09-24); these defaults are inserted only where a row is missing -
 * an edited title is never overwritten. XP thresholds are not
 * configurable here: a level is still every LEVEL_XP_STEP XP (progress.ts).
 */
export const DEFAULT_LEVEL_TITLES: readonly string[] = [
  'Marketing Starter',
  'Audience Explorer',
  'Campaign Builder',
  'Growth Explorer',
  'Growth Marketer',
  'Performance Marketer',
  'Campaign Strategist',
  'Growth Specialist',
  'Growth Expert',
  'Growth Master',
]

let ensured: Promise<unknown> | null = null

/** Inserts any missing default rows, once per server process. */
function ensureDefaultLevels() {
  ensured ??= db.growthLevel
    .createMany({ data: DEFAULT_LEVEL_TITLES.map((title, i) => ({ level: i + 1, title })), skipDuplicates: true })
    .catch((error) => {
      ensured = null // retry next time rather than caching a failure
      throw error
    })
  return ensured
}

/** Level number -> title. Levels past the last configured one keep the last title. */
export async function getLevelTitles(): Promise<(level: number) => string> {
  await ensureDefaultLevels()
  const rows = await db.growthLevel.findMany({ orderBy: { level: 'asc' } })
  const byLevel = new Map(rows.map((r) => [r.level, r.title]))
  const maxConfigured = rows.at(-1)?.level ?? DEFAULT_LEVEL_TITLES.length
  return (level: number) =>
    byLevel.get(level) ?? byLevel.get(Math.min(level, maxConfigured)) ?? DEFAULT_LEVEL_TITLES[Math.min(level, DEFAULT_LEVEL_TITLES.length) - 1]!
}

/** XP at which `level` starts (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return (Math.max(1, level) - 1) * LEVEL_XP_STEP
}
