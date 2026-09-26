import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { recordMissionProgress } from '@/lib/growth/missions'
import { claimVerifiedQuest, getQuestBoard } from '@/lib/growth/quests'
import { equipShopItem, getShopState, purchaseShopItem } from '@/lib/growth/shop'
import { cosmeticsFor } from '@/lib/growth/shop-catalog'
import { applyGrowthActivity } from '@/lib/growth/progress'
import { getLevelTitles } from '@/lib/growth/levels'
import { getProfileStats, getRecentGrowthActivity } from '@/lib/growth/profile'
import { getClientGrowthBadge } from '@/lib/growth/badge'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Quests / Shop / Profile (docs/DECISIONS.md 2026-09-24): verified quests
 * can't be self-reported or claimed early, XP can't be double-spent,
 * everything stays tenant- and permission-scoped.
 */
describe('Growth quests + shop - verification, permissions, tenant isolation', () => {
  let orgId: string
  let clientAId: string
  let clientBId: string
  let adminId: string
  let employeeId: string // assigned to Client A only
  let portalUserId: string // client role on A: growth.read, no growth.write

  const ctxFor = async (userId: string) => (await resolveAuthContext(testDb, userId, orgId))!

  beforeAll(async () => {
    orgId = (await createTestOrg()).id
    const roles = await createSystemRoles(orgId)
    clientAId = (await createTestClient(orgId, 'Quest Client A')).id
    clientBId = (await createTestClient(orgId, 'Quest Client B')).id

    adminId = (await createTestUser()).id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: adminId, roleId: roles.get('super_admin')!.id } })
    employeeId = (await createTestUser()).id
    const membership = await testDb.organizationUser.create({ data: { organizationId: orgId, userId: employeeId, roleId: roles.get('employee')!.id } })
    await testDb.clientAssignment.create({ data: { clientId: clientAId, organizationUserId: membership.id } })
    portalUserId = (await createTestUser()).id
    await testDb.clientUser.create({ data: { clientId: clientAId, userId: portalUserId } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [adminId, employeeId, portalUserId])
  })

  it('never lets a verified quest be self-reported', async () => {
    const ctx = await ctxFor(adminId)
    await expect(recordMissionProgress(ctx, clientAId, 'launch-first-campaign', 1)).rejects.toThrow('completes from your real work')
    await expect(recordMissionProgress(ctx, clientAId, 'create-3-creatives', 3)).rejects.toThrow('completes from your real work')
  })

  it('rejects malformed self-report increments', async () => {
    const ctx = await ctxFor(adminId)
    await expect(recordMissionProgress(ctx, clientAId, 'review-campaign-performance', -5)).rejects.toThrow('positive whole number')
    await expect(recordMissionProgress(ctx, clientAId, 'review-campaign-performance', Number.NaN)).rejects.toThrow('positive whole number')
  })

  it('refuses to claim before the real work exists, and refuses self-reported quests', async () => {
    const ctx = await ctxFor(adminId)
    await expect(claimVerifiedQuest(ctx, clientAId, 'launch-first-campaign')).rejects.toThrow('Not done yet - 0 of 1')
    await expect(claimVerifiedQuest(ctx, clientAId, 'find-3-audience-segments')).rejects.toThrow('can’t be claimed')
    await expect(claimVerifiedQuest(ctx, clientAId, 'no-such-quest')).rejects.toThrow('can’t be claimed')
  })

  it('counts real records, awards once, and unlocks First Campaign', async () => {
    const ctx = await ctxFor(adminId)
    await testDb.campaign.create({
      data: { organizationId: orgId, clientId: clientAId, provider: 'METRICOOL', providerCampaignId: 'qa-1', name: 'Real campaign' },
    })
    const board = await getQuestBoard(ctx, clientAId)
    const quest = board.find((q) => q.key === 'launch-first-campaign')!
    expect(quest).toMatchObject({ verified: true, progressCount: 1, claimable: true, completedAt: null })

    await claimVerifiedQuest(ctx, clientAId, 'launch-first-campaign')
    const after = await testDb.clientGrowthProgress.findUniqueOrThrow({ where: { clientId: clientAId } })
    expect(after.xp).toBe(250)
    expect(await testDb.clientGrowthAchievement.count({ where: { clientId: clientAId, achievementKey: 'first-campaign' } })).toBe(1)

    // Claiming again is a no-op: SPECIAL quests have one all-time period.
    await claimVerifiedQuest(ctx, clientAId, 'launch-first-campaign')
    expect((await testDb.clientGrowthProgress.findUniqueOrThrow({ where: { clientId: clientAId } })).xp).toBe(250)
    const boardAfter = await getQuestBoard(ctx, clientAId)
    expect(boardAfter.find((q) => q.key === 'launch-first-campaign')).toMatchObject({ claimable: false })
  })

  it("keeps each client's records separate - B's quest isn't met by A's campaign", async () => {
    const ctx = await ctxFor(adminId)
    const board = await getQuestBoard(ctx, clientBId)
    expect(board.find((q) => q.key === 'launch-first-campaign')).toMatchObject({ progressCount: 0, claimable: false })
  })

  it('blocks cross-client and read-only access', async () => {
    const employee = await ctxFor(employeeId)
    await expect(claimVerifiedQuest(employee, clientBId, 'launch-first-campaign')).rejects.toBeInstanceOf(ForbiddenError)
    await expect(purchaseShopItem(employee, clientBId, 'streak-shield')).rejects.toBeInstanceOf(ForbiddenError)
    await expect(getShopState(employee, clientBId)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(getProfileStats(employee, clientBId)).rejects.toBeInstanceOf(ForbiddenError)

    const portal = await ctxFor(portalUserId)
    expect((await getShopState(portal, clientAId)).balance).toBe(250)
    await expect(purchaseShopItem(portal, clientAId, 'streak-shield')).rejects.toBeInstanceOf(ForbiddenError)
    await expect(equipShopItem(portal, clientAId, 'mascot', null)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(claimVerifiedQuest(portal, clientAId, 'launch-first-campaign')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('spends the balance, never total XP or level, and enforces item rules', async () => {
    const ctx = await ctxFor(adminId)
    await expect(purchaseShopItem(ctx, clientBId, 'streak-shield')).rejects.toThrow('Earn some XP')
    await expect(purchaseShopItem(ctx, clientAId, 'map-sunset')).rejects.toThrow('need 350 more XP')
    await expect(purchaseShopItem(ctx, clientAId, 'not-an-item')).rejects.toThrow('isn’t in the shop')

    await testDb.clientGrowthProgress.update({ where: { clientId: clientAId }, data: { xp: 1500, level: 4 } })
    await purchaseShopItem(ctx, clientAId, 'streak-shield')
    await purchaseShopItem(ctx, clientAId, 'streak-shield')
    await expect(purchaseShopItem(ctx, clientAId, 'streak-shield')).rejects.toThrow('at most 2')

    await purchaseShopItem(ctx, clientAId, 'gummy-party-hat')
    await expect(purchaseShopItem(ctx, clientAId, 'gummy-party-hat')).rejects.toThrow('already own')

    const state = await getShopState(ctx, clientAId)
    expect(state).toMatchObject({ xp: 1500, balance: 1500 - 300 - 300 - 300, streakShields: 2 })
    const progress = await testDb.clientGrowthProgress.findUniqueOrThrow({ where: { clientId: clientAId } })
    expect(progress.level).toBe(4)
    expect(await testDb.clientGrowthPurchase.count({ where: { clientId: clientAId } })).toBe(3)
    expect(await testDb.auditEvent.count({ where: { clientId: clientAId, action: 'growth.shop_purchase' } })).toBe(3)
  })

  it('cannot double-spend the same XP under concurrent purchases', async () => {
    const ctx = await ctxFor(adminId)
    // Balance is 600: enough for exactly one of these two 400/500 items.
    const results = await Promise.allSettled([purchaseShopItem(ctx, clientAId, 'gummy-shades'), purchaseShopItem(ctx, clientAId, 'gold-confetti')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const state = await getShopState(ctx, clientAId)
    expect(state.balance).toBeGreaterThanOrEqual(0)
    expect(state.owned.size).toBe(3) // shield, party hat, + exactly one of the two
  })

  it('equips only owned items in the right slot, and exposes them to Gummy', async () => {
    const ctx = await ctxFor(adminId)
    await expect(equipShopItem(ctx, clientAId, 'mapTheme', 'map-ocean')).rejects.toThrow('Buy Ocean Growth Map first')
    await expect(equipShopItem(ctx, clientAId, 'mapTheme', 'gummy-party-hat')).rejects.toThrow('doesn’t go there')
    await equipShopItem(ctx, clientAId, 'mascot', 'gummy-party-hat')
    const row = () => testDb.clientGrowthProgress.findUniqueOrThrow({ where: { clientId: clientAId } })
    expect(cosmeticsFor(await row())).toEqual({ outfit: 'party-hat', goldCelebration: false })
    await equipShopItem(ctx, clientAId, 'mascot', null)
    expect(cosmeticsFor(await row()).outfit).toBeNull()
  })

  it('spends a Streak Shield to cover exactly one missed day', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
    await testDb.clientGrowthProgress.update({ where: { clientId: clientAId }, data: { streakCount: 5, lastActivityAt: twoDaysAgo, streakShields: 2 } })
    const updated = await applyGrowthActivity(orgId, clientAId, 10)
    expect(updated.streakCount).toBe(6)
    expect(updated.streakShields).toBe(1)
  })

  it('reads level titles from the database without overwriting edits', async () => {
    const original = await testDb.growthLevel.findUnique({ where: { level: 5 } })
    await getLevelTitles() // ensures defaults exist
    await testDb.growthLevel.update({ where: { level: 5 }, data: { title: 'Edited Title' } })
    try {
      const titleFor = await getLevelTitles()
      expect(titleFor(5)).toBe('Edited Title')
      expect(titleFor(1)).toBe((await testDb.growthLevel.findUniqueOrThrow({ where: { level: 1 } })).title)
      expect(titleFor(99)).toBe(titleFor(10))
    } finally {
      await testDb.growthLevel.update({ where: { level: 5 }, data: { title: original?.title ?? 'Growth Marketer' } })
    }
  })

  it('profile reports real counts and no invented results', async () => {
    const ctx = await ctxFor(adminId)
    const stats = await getProfileStats(ctx, clientAId)
    expect(stats).toMatchObject({ campaigns: 1, creatives: 0, missionsCompleted: 1, reach: null, clicks: null, conversions: null })
    const activity = await getRecentGrowthActivity(ctx, clientAId)
    expect(activity.map((a) => a.kind)).toEqual(expect.arrayContaining(['quest', 'achievement', 'purchase']))
    expect(activity.find((a) => a.kind === 'purchase')!.xp).toBeLessThan(0)
  })

  it('top-bar badge data (GET /api/growth/badge) is empty for anyone without access', async () => {
    expect(await getClientGrowthBadge(null, clientAId)).toBeNull()
    expect(await getClientGrowthBadge(await ctxFor(portalUserId), clientAId)).toBeNull()
    expect(await getClientGrowthBadge(await ctxFor(employeeId), clientBId)).toBeNull()
    expect(await getClientGrowthBadge(await ctxFor(adminId), 'no-such-client')).toBeNull()
    expect(await getClientGrowthBadge(await ctxFor(employeeId), clientAId)).toMatchObject({ xp: expect.any(Number), level: expect.any(Number) })
  })

  it('weekly goal counts only this week\'s other completed quests, and cannot be self-reported', async () => {
    const ctx = await ctxFor(adminId)
    await expect(recordMissionProgress(ctx, clientBId, 'weekly-goal', 7)).rejects.toThrow('completes from your real work')

    const now = new Date()
    const missions = await testDb.growthMission.findMany({ where: { key: { not: 'weekly-goal' } }, take: 8 })
    expect(missions.length).toBeGreaterThanOrEqual(7)
    const lastWeek = new Date(now.getTime() - 8 * 86_400_000)
    // 6 completions this week + 3 last week (must not count) on Client B.
    for (const [i, m] of missions.slice(0, 6).entries())
      await testDb.clientGrowthMissionProgress.create({
        data: { organizationId: orgId, clientId: clientBId, missionId: m.id, periodStart: new Date(1000 + i), progressCount: 1, completedAt: now },
      })
    for (const [i, m] of missions.slice(0, 3).entries())
      await testDb.clientGrowthMissionProgress.create({
        data: { organizationId: orgId, clientId: clientBId, missionId: m.id, periodStart: new Date(5000 + i), progressCount: 1, completedAt: lastWeek },
      })
    let goal = (await getQuestBoard(ctx, clientBId)).find((q) => q.key === 'weekly-goal')!
    expect(goal).toMatchObject({ verified: true, progressCount: 6, claimable: false })
    await expect(claimVerifiedQuest(ctx, clientBId, 'weekly-goal')).rejects.toThrow('Not done yet - 6 of 7')

    await testDb.clientGrowthMissionProgress.create({
      data: { organizationId: orgId, clientId: clientBId, missionId: missions[6]!.id, periodStart: new Date(9000), progressCount: 1, completedAt: now },
    })
    goal = (await getQuestBoard(ctx, clientBId)).find((q) => q.key === 'weekly-goal')!
    expect(goal).toMatchObject({ progressCount: 7, claimable: true })
    // Client A's completions never count toward B's goal, and vice versa.
    expect((await getQuestBoard(ctx, clientAId)).find((q) => q.key === 'weekly-goal')!.progressCount).toBeLessThan(7)

    const before = await testDb.clientGrowthProgress.findUnique({ where: { clientId: clientBId } })
    await claimVerifiedQuest(ctx, clientBId, 'weekly-goal')
    const after = await testDb.clientGrowthProgress.findUniqueOrThrow({ where: { clientId: clientBId } })
    expect(after.xp - (before?.xp ?? 0)).toBe(150)
    // Its own completion doesn't count toward itself.
    goal = (await getQuestBoard(ctx, clientBId)).find((q) => q.key === 'weekly-goal')!
    expect(goal.completedAt).not.toBeNull()
  })
})
