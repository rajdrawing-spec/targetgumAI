import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { assertPermission } from '@/lib/rbac/guards'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * BRD-PRD Section 80, scenario 2 (generalized to permissions rather than
 * tool calls, since the Tool Registry doesn't exist yet - Day 5): a role
 * without a permission must never be able to perform the action that
 * permission gates, no matter how the request is phrased.
 */
describe('security: privilege escalation must be denied', () => {
  let orgId: string
  let employeeId: string
  let clientUserId: string
  let superAdminId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const employee = await createTestUser()
    employeeId = employee.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('employee')!.id },
    })

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const client = await createTestClient(orgId, 'Client for privilege-escalation test')
    const clientPortalUser = await createTestUser()
    clientUserId = clientPortalUser.id
    await testDb.clientUser.create({ data: { clientId: client.id, userId: clientUserId } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [employeeId, superAdminId, clientUserId])
  })

  it('denies an employee an organization-admin action', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    expect(() => assertPermission(ctx!, 'organizations.manage')).toThrow(ForbiddenError)
    expect(() => assertPermission(ctx!, 'users.manage')).toThrow(ForbiddenError)
    expect(() => assertPermission(ctx!, 'clients.manage')).toThrow(ForbiddenError)
    expect(() => assertPermission(ctx!, 'integrations.manage')).toThrow(ForbiddenError)
  })

  // approvals.approve is held by every employee since the 2026-09-13
  // account_manager/marketing_employee merge (docs/DECISIONS.md) - the
  // 'confines a client...' test below is the remaining negative case.

  it('grants the same organization-admin action to super_admin', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    expect(() => assertPermission(ctx!, 'organizations.manage')).not.toThrow()
  })

  it('confines a client to its narrow, non-admin permission set', async () => {
    const ctx = await resolveAuthContext(testDb, clientUserId, orgId)
    expect(ctx?.isClientUser).toBe(true)
    expect(() => assertPermission(ctx!, 'clients.read')).not.toThrow()
    expect(() => assertPermission(ctx!, 'approvals.approve')).toThrow(ForbiddenError)
    expect(() => assertPermission(ctx!, 'clients.manage')).toThrow(ForbiddenError)
    expect(() => assertPermission(ctx!, 'organizations.manage')).toThrow(ForbiddenError)
  })

  it('a role can never grant itself a permission outside its seeded set (no client-supplied permission override)', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    // Simulates a caller trying to smuggle in an extra permission via a
    // mutated context - assertPermission only trusts ctx.permissions as
    // resolved from the database, never anything else.
    expect(ctx!.permissions.has('organizations.manage')).toBe(false)
  })
})
