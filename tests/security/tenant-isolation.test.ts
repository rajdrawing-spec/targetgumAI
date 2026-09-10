import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { assertClientAccess } from '@/lib/rbac/guards'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * BRD-PRD Section 80, scenario 1: "User assigned to Client A requests
 * Client B." Also covers scenario 8's organization half ("credential
 * belonging to another [org's] client") at the client-access-check level -
 * the credential/OAuth-connection-specific case lands with the Integrations
 * module (Week 2).
 */
describe('security: cross-client access must be denied', () => {
  let orgId: string
  let otherOrgId: string
  let employeeId: string
  let clientAId: string
  let clientBId: string
  let foreignClientId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const clientA = await createTestClient(orgId, 'Client A')
    const clientB = await createTestClient(orgId, 'Client B')
    clientAId = clientA.id
    clientBId = clientB.id

    const employee = await createTestUser()
    employeeId = employee.id
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({
      data: { clientId: clientAId, organizationUserId: membership.id },
    })

    const otherOrg = await createTestOrg()
    otherOrgId = otherOrg.id
    const foreignClient = await createTestClient(otherOrgId, 'Foreign Org Client')
    foreignClientId = foreignClient.id
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [employeeId])
    await cleanupOrg(otherOrgId)
  })

  it('denies a user assigned to Client A when it requests Client B in the same org', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    expect(ctx).not.toBeNull()
    const clientB = await testDb.client.findUniqueOrThrow({ where: { id: clientBId } })
    expect(() => assertClientAccess(ctx!, clientB)).toThrow(ForbiddenError)
  })

  it('allows the same user access to the client it is actually assigned to', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    const clientA = await testDb.client.findUniqueOrThrow({ where: { id: clientAId } })
    expect(() => assertClientAccess(ctx!, clientA)).not.toThrow()
  })

  it('denies access to a client belonging to an entirely different organization', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    const foreignClient = await testDb.client.findUniqueOrThrow({ where: { id: foreignClientId } })
    expect(() => assertClientAccess(ctx!, foreignClient)).toThrow(ForbiddenError)
  })

  it('denies a client-portal user for a client other than their own', async () => {
    const clientPortalUser = await createTestUser()
    await testDb.clientUser.create({ data: { clientId: clientAId, userId: clientPortalUser.id } })
    try {
      const ctx = await resolveAuthContext(testDb, clientPortalUser.id, orgId)
      expect(ctx?.isClientUser).toBe(true)
      const clientB = await testDb.client.findUniqueOrThrow({ where: { id: clientBId } })
      expect(() => assertClientAccess(ctx!, clientB)).toThrow(ForbiddenError)
    } finally {
      await testDb.user.delete({ where: { id: clientPortalUser.id } }).catch(() => undefined)
    }
  })
})
