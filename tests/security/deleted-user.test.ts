import { afterAll, describe, expect, it } from 'vitest'
import { resolveAuthContext } from '@/lib/rbac/context'
import {
  cleanupOrg,
  createSystemRoles,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * BRD-PRD Section 80, scenario 9: "Deleted user attempts API access."
 * There is no hard-delete of users in the schema (audit/history integrity),
 * so "deleted" is modeled as User.status = DISABLED - resolveAuthContext
 * must deny regardless of how active/valid the underlying membership row
 * still is.
 */
describe('security: disabled/deleted user access must be denied', () => {
  const createdOrgIds: string[] = []
  const createdUserIds: string[] = []

  afterAll(async () => {
    await Promise.all(createdOrgIds.map((id) => cleanupOrg(id)))
    if (createdUserIds.length > 0) {
      await testDb.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => undefined)
    }
  })

  it('denies context resolution for a disabled user even with an active, fully-permissioned membership', async () => {
    const org = await createTestOrg()
    createdOrgIds.push(org.id)
    const roles = await createSystemRoles(org.id)

    const user = await createTestUser({ status: 'DISABLED' })
    createdUserIds.push(user.id)
    await testDb.organizationUser.create({
      data: { organizationId: org.id, userId: user.id, roleId: roles.get('super_admin')!.id },
    })

    const ctx = await resolveAuthContext(testDb, user.id, org.id)
    expect(ctx).toBeNull()
  })

  it('denies context resolution for a user disabled after their membership was created', async () => {
    const org = await createTestOrg()
    createdOrgIds.push(org.id)
    const roles = await createSystemRoles(org.id)

    const user = await createTestUser({ status: 'ACTIVE' })
    createdUserIds.push(user.id)
    await testDb.organizationUser.create({
      data: { organizationId: org.id, userId: user.id, roleId: roles.get('super_admin')!.id },
    })

    // Sanity check: access works while active.
    expect(await resolveAuthContext(testDb, user.id, org.id)).not.toBeNull()

    await testDb.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } })

    expect(await resolveAuthContext(testDb, user.id, org.id)).toBeNull()
  })

  it('denies a user with no membership in the organization at all', async () => {
    const org = await createTestOrg()
    createdOrgIds.push(org.id)
    const user = await createTestUser()
    createdUserIds.push(user.id)

    expect(await resolveAuthContext(testDb, user.id, org.id)).toBeNull()
  })

  it('denies a user whose OrganizationUser membership itself is disabled, even though the user account is active', async () => {
    const org = await createTestOrg()
    createdOrgIds.push(org.id)
    const roles = await createSystemRoles(org.id)

    const user = await createTestUser({ status: 'ACTIVE' })
    createdUserIds.push(user.id)
    await testDb.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        roleId: roles.get('employee')!.id,
        status: 'DISABLED',
      },
    })

    expect(await resolveAuthContext(testDb, user.id, org.id)).toBeNull()
  })
})
