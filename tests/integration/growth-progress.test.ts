import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getGrowthProgress } from '@/lib/growth/progress'
import { completeStage, getStageStates } from '@/lib/growth/stages'
import { getMissionProgress, getWeeklyMissionCompletionCount, recordMissionProgress } from '@/lib/growth/missions'
import { listAchievements } from '@/lib/growth/achievements'
import { ForbiddenError } from '@/lib/rbac/errors'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

describe('Growth Map (guided onboarding) - tenant + permission enforced, XP/streak math', () => {
  let orgId: string
  let clientAId: string
  let clientBId: string
  let superAdminId: string
  let employeeId: string // employee, assigned to Client A only
  let clientPortalUserId: string // `client` role - has growth.read but not growth.write

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const clientA = await createTestClient(orgId, 'Growth Client A')
    const clientB = await createTestClient(orgId, 'Growth Client B')
    clientAId = clientA.id
    clientBId = clientB.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id } })

    const employee = await createTestUser()
    employeeId = employee.id
    const membership = await testDb.organizationUser.create({ data: { organizationId: orgId, userId: employeeId, roleId: roles.get('employee')!.id } })
    await testDb.clientAssignment.create({ data: { clientId: clientAId, organizationUserId: membership.id } })

    const clientPortalUser = await createTestUser()
    clientPortalUserId = clientPortalUser.id
    await testDb.clientUser.create({ data: { clientId: clientAId, userId: clientPortalUserId } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId, clientPortalUserId])
  })

  it('getGrowthProgress returns null before the client has started', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    expect(await getGrowthProgress(ctx!, clientAId)).toBeNull()
  })

  it('completeStage advances the current stage, awards XP, and starts the streak at 1', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const progress = await completeStage(ctx!, clientAId, 'DEFINE_BUSINESS')
    expect(progress.currentStage).toBe('UNDERSTAND_AUDIENCE')
    expect(progress.xp).toBe(100)
    expect(progress.level).toBe(1)
    expect(progress.streakCount).toBe(1)
  })

  it('rejects completing a stage out of order', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(completeStage(ctx!, clientAId, 'CREATE_OFFER')).rejects.toThrow('Complete stages in order')
  })

  it('rejects re-completing a stage that is no longer current (race-condition guard)', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    // Simulate a race: rewind currentStage back to an already-completed stage.
    await testDb.clientGrowthProgress.update({ where: { clientId: clientAId }, data: { currentStage: 'DEFINE_BUSINESS' } })
    await expect(completeStage(ctx!, clientAId, 'DEFINE_BUSINESS')).rejects.toThrow('already completed')
    // Restore forward progress for the tests that follow.
    await testDb.clientGrowthProgress.update({ where: { clientId: clientAId }, data: { currentStage: 'UNDERSTAND_AUDIENCE' } })
  })

  it('streak: same-day activity does not double-count, next UTC day increments, a gap resets to 1', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)

    // Completing UNDERSTAND_AUDIENCE happens "today" (same UTC day as DEFINE_BUSINESS above) - streak unchanged at 1.
    let progress = await completeStage(ctx!, clientAId, 'UNDERSTAND_AUDIENCE')
    expect(progress.streakCount).toBe(1)
    expect(progress.currentStage).toBe('RESEARCH_MARKET')

    // Back-date lastActivityAt by one UTC day, then complete the next stage - streak should extend to 2.
    const yesterday = new Date(progress.lastActivityAt!.getTime() - 24 * 60 * 60 * 1000)
    await testDb.clientGrowthProgress.update({ where: { clientId: clientAId }, data: { lastActivityAt: yesterday } })
    progress = await completeStage(ctx!, clientAId, 'RESEARCH_MARKET')
    expect(progress.streakCount).toBe(2)

    // Back-date by 3 UTC days (a gap) - streak should reset to 1.
    const threeDaysAgo = new Date(progress.lastActivityAt!.getTime() - 3 * 24 * 60 * 60 * 1000)
    await testDb.clientGrowthProgress.update({ where: { clientId: clientAId }, data: { lastActivityAt: threeDaysAgo } })
    progress = await completeStage(ctx!, clientAId, 'CREATE_OFFER')
    expect(progress.streakCount).toBe(1)
  })

  it('unlocks the audience-explorer achievement on completing UNDERSTAND_AUDIENCE', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const achievements = await listAchievements(ctx!, clientAId)
    const audienceExplorer = achievements.find((a) => a.key === 'audience-explorer')
    expect(audienceExplorer?.unlocked).toBe(true)
    const creativeMaster = achievements.find((a) => a.key === 'creative-master')
    expect(creativeMaster?.unlocked).toBe(false)
  })

  it('getStageStates reports done/current/locked correctly', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const states = await getStageStates(ctx!, clientAId)
    const byKey = new Map(states.map((s) => [s.key, s.status]))
    expect(byKey.get('DEFINE_BUSINESS')).toBe('done')
    expect(byKey.get('UNDERSTAND_AUDIENCE')).toBe('done')
    expect(byKey.get('RESEARCH_MARKET')).toBe('done')
    expect(byKey.get('CREATE_OFFER')).toBe('done')
    expect(byKey.get('CREATE_CREATIVE_ASSETS')).toBe('current')
    expect(byKey.get('BUILD_CAMPAIGN')).toBe('locked')
  })

  it('denies a client (lacks growth.write) from completing a stage', async () => {
    const ctx = await resolveAuthContext(testDb, clientPortalUserId, orgId)
    await expect(completeStage(ctx!, clientAId, 'CREATE_CREATIVE_ASSETS')).rejects.toThrow(ForbiddenError)
  })

  it('a client (has growth.read) can still read progress', async () => {
    const ctx = await resolveAuthContext(testDb, clientPortalUserId, orgId)
    const progress = await getGrowthProgress(ctx!, clientAId)
    expect(progress?.currentStage).toBe('CREATE_CREATIVE_ASSETS')
  })

  it('denies cross-client access to an employee assigned only to Client A', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    await expect(completeStage(ctx!, clientBId, 'DEFINE_BUSINESS')).rejects.toThrow(ForbiddenError)
    await expect(getGrowthProgress(ctx!, clientBId)).rejects.toThrow(ForbiddenError)
  })

  describe('missions', () => {
    let dailyMissionKey: string

    beforeAll(async () => {
      dailyMissionKey = `test-daily-${Date.now()}`
      await testDb.growthMission.create({
        data: { key: dailyMissionKey, cadence: 'DAILY', title: 'Test daily mission', xpReward: 40, targetCount: 3 },
      })
    })

    it('increments progress and completes once the target is reached, awarding XP once', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const before = await getGrowthProgress(ctx!, clientAId)
      const baselineXp = before?.xp ?? 0

      let result = await recordMissionProgress(ctx!, clientAId, dailyMissionKey, 1)
      expect(result.progressCount).toBe(1)
      expect(result.completedAt).toBeNull()

      result = await recordMissionProgress(ctx!, clientAId, dailyMissionKey, 1)
      expect(result.progressCount).toBe(2)

      result = await recordMissionProgress(ctx!, clientAId, dailyMissionKey, 1)
      expect(result.progressCount).toBe(3)
      expect(result.completedAt).not.toBeNull()

      const afterFirstComplete = await getGrowthProgress(ctx!, clientAId)
      expect(afterFirstComplete!.xp).toBe(baselineXp + 40)

      // Calling again after completion is a no-op - no double XP.
      result = await recordMissionProgress(ctx!, clientAId, dailyMissionKey, 1)
      expect(result.progressCount).toBe(3)
      const afterExtraCall = await getGrowthProgress(ctx!, clientAId)
      expect(afterExtraCall!.xp).toBe(baselineXp + 40)
    })

    it('getMissionProgress reflects the completed state for the current period', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const missions = await getMissionProgress(ctx!, clientAId)
      const thisMission = missions.find((m) => m.mission.key === dailyMissionKey)
      expect(thisMission?.progressCount).toBe(3)
      expect(thisMission?.completedAt).not.toBeNull()
    })

    it('getWeeklyMissionCompletionCount counts completions in the current UTC week', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const count = await getWeeklyMissionCompletionCount(ctx!, clientAId)
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('rejects progress on an unknown mission key', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      await expect(recordMissionProgress(ctx!, clientAId, 'not-a-real-mission', 1)).rejects.toThrow('not available')
    })
  })
})
