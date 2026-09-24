import { describe, expect, it } from 'vitest'
import { levelUpFrom, nextStreak } from '@/lib/growth/progress'
import { periodEndFor, periodStartFor } from '@/lib/growth/missions'
import { QUEST_DEFS, VERIFIED_QUEST_KEYS } from '@/lib/growth/quest-defs'
import { VERIFIER_KEYS } from '@/lib/growth/quests'
import { MISSION_SCREEN_LINKS } from '@/lib/growth/mission-links'
import { MAP_THEME_CLASSES, MASCOT_OUTFITS, SHOP_ITEMS } from '@/lib/growth/shop-catalog'
import { DEFAULT_LEVEL_TITLES, xpForLevel } from '@/lib/growth/levels'

const day = (n: number) => new Date(n * 86_400_000 + 5 * 3_600_000)

describe('streak with Streak Shields', () => {
  it('keeps the original rules without shields', () => {
    expect(nextStreak(0, null, 0, day(10))).toEqual({ streakCount: 1, shieldsUsed: 0 })
    expect(nextStreak(4, day(10), 0, day(10))).toEqual({ streakCount: 4, shieldsUsed: 0 })
    expect(nextStreak(4, day(10), 0, day(11))).toEqual({ streakCount: 5, shieldsUsed: 0 })
    expect(nextStreak(4, day(10), 0, day(12))).toEqual({ streakCount: 1, shieldsUsed: 0 })
  })

  it('uses exactly one shield to cover exactly one missed day', () => {
    expect(nextStreak(4, day(10), 2, day(12))).toEqual({ streakCount: 5, shieldsUsed: 1 })
    // Consecutive days never spend a shield.
    expect(nextStreak(4, day(10), 2, day(11))).toEqual({ streakCount: 5, shieldsUsed: 0 })
    // Two or more missed days reset even with shields in hand.
    expect(nextStreak(4, day(10), 2, day(13))).toEqual({ streakCount: 1, shieldsUsed: 0 })
  })
})

describe('quest catalog', () => {
  it('gives every verified quest a real-record counter, and only verified quests', () => {
    expect([...VERIFIED_QUEST_KEYS].sort()).toEqual([...VERIFIER_KEYS].sort())
  })

  it('has unique keys, positive rewards/targets, and a deep link for every quest', () => {
    expect(new Set(QUEST_DEFS.map((q) => q.key)).size).toBe(QUEST_DEFS.length)
    for (const q of QUEST_DEFS) {
      expect(q.xpReward).toBeGreaterThan(0)
      expect(q.targetCount).toBeGreaterThan(0)
      expect(MISSION_SCREEN_LINKS[q.key]?.href('c1')).toMatch(/^\/dashboard\//)
    }
  })

  it('offers daily, weekly and special quests', () => {
    expect(new Set(QUEST_DEFS.map((q) => q.cadence))).toEqual(new Set(['DAILY', 'WEEKLY', 'SPECIAL']))
  })

  it('gives SPECIAL quests one all-time period', () => {
    const start = periodStartFor('SPECIAL', new Date('2026-09-24T10:00:00Z'))
    expect(start.getTime()).toBe(0)
    expect(periodStartFor('SPECIAL', new Date('2030-01-01T00:00:00Z')).getTime()).toBe(0)
    expect(periodEndFor('SPECIAL', start)).toBeNull()
    const weekStart = periodStartFor('WEEKLY', new Date('2026-09-24T10:00:00Z')) // a Thursday
    expect(weekStart.toISOString()).toBe('2026-09-21T00:00:00.000Z')
    expect(periodEndFor('WEEKLY', weekStart)!.toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })
})

describe('shop catalog rules', () => {
  it('sells nothing that inflates XP or unlocks business features', () => {
    for (const item of SHOP_ITEMS) {
      expect(`${item.key} ${item.name} ${item.description}`).not.toMatch(/multiplier|2x|double xp|campaign boost|ai suggestion|unlock/i)
      expect(['boosts', 'mascots', 'themes', 'rewards']).toContain(item.category)
      expect(item.xpCost).toBeGreaterThan(0)
    }
  })

  it('wires every cosmetic to a real effect', () => {
    for (const item of SHOP_ITEMS.filter((i) => i.kind === 'cosmetic')) {
      expect(item.slot).toBeDefined()
      if (item.slot === 'mascot') expect(MASCOT_OUTFITS[item.key]).toBeDefined()
      if (item.slot === 'mapTheme') expect(MAP_THEME_CLASSES[item.key]).toBeDefined()
      if (item.slot === 'celebration') expect(item.key).toBe('gold-confetti')
    }
    const consumables = SHOP_ITEMS.filter((i) => i.kind === 'consumable')
    expect(consumables.map((i) => i.key)).toEqual(['streak-shield'])
  })
})

describe('levels', () => {
  it('has the ten default titles and flat XP thresholds', () => {
    expect(DEFAULT_LEVEL_TITLES).toHaveLength(10)
    expect(DEFAULT_LEVEL_TITLES[4]).toBe('Growth Marketer')
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(6)).toBe(2500)
  })
})

describe('level-up detection', () => {
  it('reports the new level only when a gain crosses a boundary', () => {
    expect(levelUpFrom(1550, 250)).toBe(4) // 1300 (L3) -> 1550 (L4)
    expect(levelUpFrom(1450, 100)).toBeNull() // 1350 -> 1450, still L3
    expect(levelUpFrom(500, 500)).toBe(2) // 0 -> 500
    expect(levelUpFrom(2100, 1200)).toBe(5) // jumps two levels, reports the one reached
    expect(levelUpFrom(300, 0)).toBeNull()
  })
})
