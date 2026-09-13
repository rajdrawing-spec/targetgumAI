import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveAuthContext, resolveDefaultOrganizationId } from '@/lib/rbac/context'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

describe('resolveAuthContext (against a real database)', () => {
  let orgId: string
  let superAdminId: string
  let employeeId: string
  let clientUserId: string
  let clientAId: string
  let clientBId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const clientA = await createTestClient(orgId, 'Client A')
    const clientB = await createTestClient(orgId, 'Client B')
    clientAId = clientA.id
    clientBId = clientB.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const employee = await createTestUser()
    employeeId = employee.id
    const employeeMembership = await testDb.organizationUser.create({
      data: {
        organizationId: orgId,
        userId: employeeId,
        roleId: roles.get('employee')!.id,
      },
    })
    await testDb.clientAssignment.create({
      data: { clientId: clientAId, organizationUserId: employeeMembership.id },
    })

    const clientPortalUser = await createTestUser()
    clientUserId = clientPortalUser.id
    await testDb.clientUser.create({ data: { clientId: clientAId, userId: clientUserId } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId, clientUserId])
  })

  it('gives super_admin ALL-client access within the organization', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    expect(ctx?.roleKey).toBe('super_admin')
    expect(ctx?.clientAccess.kind).toBe('ALL')
    expect(ctx?.permissions.has('organizations.manage')).toBe(true)
  })

  it('scopes employee access to their ClientAssignment rows only', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    expect(ctx?.roleKey).toBe('employee')
    expect(ctx?.clientAccess.kind).toBe('SET')
    if (ctx?.clientAccess.kind === 'SET') {
      expect(ctx.clientAccess.clientIds.has(clientAId)).toBe(true)
      expect(ctx.clientAccess.clientIds.has(clientBId)).toBe(false)
    }
    expect(ctx?.permissions.has('organizations.manage')).toBe(false)
  })

  it('resolves a client-portal user to their ClientUser rows, marked isClientUser', async () => {
    const ctx = await resolveAuthContext(testDb, clientUserId, orgId)
    expect(ctx?.isClientUser).toBe(true)
    expect(ctx?.roleKey).toBe('client')
    if (ctx?.clientAccess.kind === 'SET') {
      expect(ctx.clientAccess.clientIds.has(clientAId)).toBe(true)
      expect(ctx.clientAccess.clientIds.size).toBe(1)
    }
  })

  it('resolveDefaultOrganizationId prefers staff membership over client-portal access', async () => {
    const orgId2 = await resolveDefaultOrganizationId(testDb, employeeId)
    expect(orgId2).toBe(orgId)
  })
})
