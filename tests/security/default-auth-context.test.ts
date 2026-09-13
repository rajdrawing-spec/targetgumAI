import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveAuthContext, resolveDefaultAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * `resolveDefaultAuthContext` is the merged, single-round-trip version of
 * `resolveDefaultOrganizationId` + `resolveAuthContext` that every
 * dashboard request now goes through (src/lib/auth/current-context.ts).
 * It must make exactly the same decisions as the two-step path it
 * replaces - in particular the deny cases the security suite already
 * pins on `resolveAuthContext` (tests/security/deleted-user.test.ts).
 */
describe('security: resolveDefaultAuthContext matches the two-step resolution', () => {
  let orgId: string
  let clientAId: string
  let clientBId: string
  const userIds: string[] = []
  let roles: Map<string, { id: string }>

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    roles = await createSystemRoles(orgId)
    clientAId = (await createTestClient(orgId, 'Default Ctx Client A')).id
    clientBId = (await createTestClient(orgId, 'Default Ctx Client B')).id
  })

  afterAll(async () => {
    await cleanupOrg(orgId, userIds)
  })

  it('resolves a super_admin with ALL client access and the same permissions as resolveAuthContext', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: user.id, roleId: roles.get('super_admin')!.id } })

    const merged = await resolveDefaultAuthContext(testDb, user.id)
    const twoStep = await resolveAuthContext(testDb, user.id, orgId)
    expect(merged).not.toBeNull()
    expect(merged!.organizationId).toBe(orgId)
    expect(merged!.roleKey).toBe('super_admin')
    expect(merged!.clientAccess.kind).toBe('ALL')
    expect(Array.from(merged!.permissions).sort()).toEqual(Array.from(twoStep!.permissions).sort())
  })

  it('resolves a scoped role with exactly its assigned clients (Client A, never Client B)', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: user.id, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId: clientAId, organizationUserId: membership.id } })

    const ctx = await resolveDefaultAuthContext(testDb, user.id)
    expect(ctx!.clientAccess.kind).toBe('SET')
    const ids = ctx!.clientAccess.kind === 'SET' ? ctx!.clientAccess.clientIds : new Set<string>()
    expect(ids.has(clientAId)).toBe(true)
    expect(ids.has(clientBId)).toBe(false)
  })

  it('denies a DISABLED user even with an active, fully-permissioned membership', async () => {
    const user = await createTestUser({ status: 'DISABLED' })
    userIds.push(user.id)
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: user.id, roleId: roles.get('super_admin')!.id } })
    expect(await resolveDefaultAuthContext(testDb, user.id)).toBeNull()
  })

  it('ignores a DISABLED membership and returns null when no client-portal access exists either', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: user.id, roleId: roles.get('super_admin')!.id, status: 'DISABLED' },
    })
    expect(await resolveDefaultAuthContext(testDb, user.id)).toBeNull()
  })

  it('falls back to client-portal access for a user with only a ClientUser row', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    await testDb.clientUser.create({ data: { clientId: clientAId, userId: user.id } })

    const ctx = await resolveDefaultAuthContext(testDb, user.id)
    expect(ctx).not.toBeNull()
    expect(ctx!.isClientUser).toBe(true)
    expect(ctx!.roleKey).toBe('client')
    expect(ctx!.clientAccess.kind === 'SET' && ctx!.clientAccess.clientIds.has(clientAId)).toBe(true)
    expect(ctx!.clientAccess.kind === 'SET' && ctx!.clientAccess.clientIds.has(clientBId)).toBe(false)
  })

  it('returns null for a user with no membership and no client access at all', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    expect(await resolveDefaultAuthContext(testDb, user.id)).toBeNull()
  })
})
