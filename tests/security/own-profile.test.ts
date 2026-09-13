import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyPassword } from '@/lib/auth/password'
import { changeOwnPassword, getOwnProfile, updateOwnName } from '@/lib/users/profile'
import type { AuthContext } from '@/lib/rbac/types'
import { cleanupOrg, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * "My Account" self-service (src/lib/users/profile.ts,
 * src/app/dashboard/account/) - every function here touches exclusively
 * `ctx.userId`, never a caller-supplied id, so the security property to
 * pin isn't "is this permitted" (there's no permission to check) but "does
 * a password change actually require proof of the current password, and
 * does it never silently succeed/fail in the wrong direction."
 */
describe('security: self-service profile and password change', () => {
  let orgId: string
  const userIds: string[] = []

  function ctxFor(userId: string): AuthContext {
    return {
      userId,
      organizationId: orgId,
      roleKey: 'employee',
      permissions: new Set(),
      clientAccess: { kind: 'ALL' },
      isClientUser: false,
    }
  }

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
  })

  afterAll(async () => {
    await cleanupOrg(orgId, userIds)
  })

  describe('updateOwnName', () => {
    it('updates only the caller\'s own row', async () => {
      const a = await createTestUser()
      const b = await createTestUser()
      userIds.push(a.id, b.id)

      await updateOwnName(ctxFor(a.id), { name: 'A New Name' })

      const refreshedA = await testDb.user.findUniqueOrThrow({ where: { id: a.id } })
      const refreshedB = await testDb.user.findUniqueOrThrow({ where: { id: b.id } })
      expect(refreshedA.name).toBe('A New Name')
      expect(refreshedB.name).toBe(b.name) // untouched
    })

    it('rejects a blank name', async () => {
      const user = await createTestUser()
      userIds.push(user.id)
      await expect(updateOwnName(ctxFor(user.id), { name: '   ' })).rejects.toThrow()
    })
  })

  describe('changeOwnPassword', () => {
    it('succeeds with the correct current password and the new hash actually verifies', async () => {
      const user = await createTestUser() // factory hashes 'irrelevant-for-these-tests'
      userIds.push(user.id)

      await changeOwnPassword(ctxFor(user.id), {
        currentPassword: 'irrelevant-for-these-tests',
        newPassword: 'a-brand-new-password',
      })

      const refreshed = await testDb.user.findUniqueOrThrow({ where: { id: user.id } })
      await expect(verifyPassword('a-brand-new-password', refreshed.passwordHash!)).resolves.toBe(true)
      await expect(verifyPassword('irrelevant-for-these-tests', refreshed.passwordHash!)).resolves.toBe(false)
    })

    it('rejects an incorrect current password and leaves the hash unchanged', async () => {
      const user = await createTestUser()
      userIds.push(user.id)
      const before = await testDb.user.findUniqueOrThrow({ where: { id: user.id } })

      await expect(
        changeOwnPassword(ctxFor(user.id), {
          currentPassword: 'definitely-the-wrong-password',
          newPassword: 'a-brand-new-password',
        }),
      ).rejects.toThrow(/current password/i)

      const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } })
      expect(after.passwordHash).toBe(before.passwordHash)

      const denied = await testDb.auditEvent.findFirst({
        where: { userId: user.id, action: 'user.password.change_denied' },
        orderBy: { timestamp: 'desc' },
      })
      expect(denied?.result).toBe('DENIED')
    })

    it('requires a current password when the account already has one - never skippable just for being signed in', async () => {
      const user = await createTestUser()
      userIds.push(user.id)

      await expect(
        changeOwnPassword(ctxFor(user.id), { newPassword: 'a-brand-new-password' }),
      ).rejects.toThrow(/current password/i)

      const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } })
      expect(after.passwordHash).not.toBeNull()
    })

    it('rejects a new password identical to the current one', async () => {
      const user = await createTestUser()
      userIds.push(user.id)

      await expect(
        changeOwnPassword(ctxFor(user.id), {
          currentPassword: 'irrelevant-for-these-tests',
          newPassword: 'irrelevant-for-these-tests',
        }),
      ).rejects.toThrow(/different/i)
    })

    it('rejects a new password shorter than 10 characters', async () => {
      const user = await createTestUser()
      userIds.push(user.id)

      await expect(
        changeOwnPassword(ctxFor(user.id), {
          currentPassword: 'irrelevant-for-these-tests',
          newPassword: 'short1',
        }),
      ).rejects.toThrow()
    })

    it('lets a Google-only account (no password yet) set its first password without a current password', async () => {
      const user = await createTestUser()
      userIds.push(user.id)
      await testDb.user.update({ where: { id: user.id }, data: { passwordHash: null } })

      await changeOwnPassword(ctxFor(user.id), { newPassword: 'a-brand-new-password' })

      const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } })
      await expect(verifyPassword('a-brand-new-password', after.passwordHash!)).resolves.toBe(true)

      const audited = await testDb.auditEvent.findFirst({
        where: { userId: user.id, action: 'user.password.set' },
      })
      expect(audited?.result).toBe('SUCCESS')
    })
  })

  describe('getOwnProfile', () => {
    it('reports hasPassword correctly and never leaks the hash itself', async () => {
      const user = await createTestUser()
      userIds.push(user.id)

      const profile = await getOwnProfile(ctxFor(user.id))
      expect(profile.hasPassword).toBe(true)
      expect(profile).not.toHaveProperty('passwordHash')

      await testDb.user.update({ where: { id: user.id }, data: { passwordHash: null } })
      const profileAfter = await getOwnProfile(ctxFor(user.id))
      expect(profileAfter.hasPassword).toBe(false)
    })
  })
})
