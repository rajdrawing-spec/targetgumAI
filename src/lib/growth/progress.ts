import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import type { ClientGrowthProgress } from '@prisma/client'
import { FIRST_GROWTH_STAGE } from './stage-defs'

/**
 * Growth Map progress (XP/level/streak/current-stage) - the additive
 * guided-onboarding layer, see docs/DATA-MODEL.md "Growth Map" and
 * docs/DECISIONS.md 2026-09-22. Per-stage completion history lives in
 * `ClientGrowthStageCompletion` (stages.ts); this file only owns the
 * rolled-up header state shown at the top of the wizard.
 */

/** XP needed per level, flat (level N starts at (N-1) * LEVEL_XP_STEP XP). */
export const LEVEL_XP_STEP = 500

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / LEVEL_XP_STEP) + 1
}

/** The level reached if gaining `gained` XP (ending at `xpAfter`) crossed a level boundary, else null. */
export function levelUpFrom(xpAfter: number, gained: number): number | null {
  const after = levelForXp(xpAfter)
  return after > levelForXp(xpAfter - Math.max(0, gained)) ? after : null
}

export function xpToNextLevel(xp: number): number {
  const remainder = Math.max(0, xp) % LEVEL_XP_STEP
  return LEVEL_XP_STEP - remainder
}

/**
 * Streak rule: same UTC calendar day as last activity -> unchanged: the
 * very next UTC calendar day -> +1; anything else (including no prior
 * activity) -> resets to 1. Deliberately simple (UTC, not the client's
 * timezone) to match the cron/audit timestamps already used throughout
 * this app.
 *
 * Streak Shields (Growth Shop, docs/DECISIONS.md 2026-09-24): a gap of
 * exactly one missed day (activity two days after the last one) consumes
 * one shield and continues the streak instead of resetting it. Longer
 * gaps still reset - one shield covers one day, never more.
 */
export function nextStreak(
  currentStreak: number,
  lastActivityAt: Date | null,
  shields: number,
  now: Date,
): { streakCount: number; shieldsUsed: number } {
  if (!lastActivityAt) return { streakCount: 1, shieldsUsed: 0 }
  const dayMs = 24 * 60 * 60 * 1000
  const lastDay = Math.floor(lastActivityAt.getTime() / dayMs)
  const today = Math.floor(now.getTime() / dayMs)
  const diff = today - lastDay
  if (diff <= 0) return { streakCount: currentStreak, shieldsUsed: 0 }
  if (diff === 1) return { streakCount: currentStreak + 1, shieldsUsed: 0 }
  if (diff === 2 && shields > 0 && currentStreak > 0) return { streakCount: currentStreak + 1, shieldsUsed: 1 }
  return { streakCount: 1, shieldsUsed: 0 }
}

/**
 * Ensures a progress row exists, then applies one activity event to it
 * (XP gain + streak update). Used by both stage completion and mission
 * progress so streak/level logic lives in exactly one place. Not exported
 * on its own - always call through completeStage/recordMissionProgress so
 * the audit trail stays meaningful (each caller writes its own audit
 * event describing *what* happened).
 */
export async function applyGrowthActivity(
  organizationId: string,
  clientId: string,
  xpGained: number,
  now: Date = new Date(),
): Promise<ClientGrowthProgress> {
  const existing = await db.clientGrowthProgress.findUnique({ where: { clientId } })
  const { streakCount, shieldsUsed } = nextStreak(existing?.streakCount ?? 0, existing?.lastActivityAt ?? null, existing?.streakShields ?? 0, now)
  const xp = (existing?.xp ?? 0) + xpGained
  const level = levelForXp(xp)

  return db.clientGrowthProgress.upsert({
    where: { clientId },
    create: {
      organizationId,
      clientId,
      currentStage: FIRST_GROWTH_STAGE,
      xp,
      level,
      streakCount,
      lastActivityAt: now,
    },
    update: { xp, level, streakCount, lastActivityAt: now, ...(shieldsUsed ? { streakShields: { decrement: shieldsUsed } } : {}) },
  })
}

/** Read-only: null if the client hasn't started the Growth Map yet. */
export async function getGrowthProgress(ctx: AuthContext, clientId: string): Promise<ClientGrowthProgress | null> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  return db.clientGrowthProgress.findUnique({ where: { clientId: client.id } })
}
