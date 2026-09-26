import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveAuthContext } from '@/lib/rbac/context'
import { resolveLearnClientId } from '@/lib/growth/learn-target'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * The sidebar's Learn links (/dashboard/go/:section) pick a client from a
 * browser cookie (docs/DECISIONS.md 2026-09-26). The cookie is attacker-
 * controlled, so it must never open a client outside the caller's access.
 */
describe('Learn navigation - the last-client cookie never widens access', () => {
  let orgId: string
  let otherOrgId: string
  let assignedId: string
  let unassignedId: string
  let archivedId: string
  let foreignId: string
  let adminId: string
  let employeeId: string
  let loneEmployeeId: string

  const ctxFor = async (userId: string, org = orgId) => (await resolveAuthContext(testDb, userId, org))!

  beforeAll(async () => {
    orgId = (await createTestOrg()).id
    otherOrgId = (await createTestOrg()).id
    const roles = await createSystemRoles(orgId)
    const otherRoles = await createSystemRoles(otherOrgId)
    // Names chosen so alphabetical order is Archived < Assigned < Unassigned.
    archivedId = (await createTestClient(orgId, 'Aa Archived Client')).id
    await testDb.client.update({ where: { id: archivedId }, data: { status: 'ARCHIVED' } })
    assignedId = (await createTestClient(orgId, 'Ab Assigned Client')).id
    unassignedId = (await createTestClient(orgId, 'Zz Unassigned Client')).id
    foreignId = (await createTestClient(otherOrgId, 'Other Org Client')).id

    adminId = (await createTestUser()).id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: adminId, roleId: roles.get('super_admin')!.id } })
    await testDb.organizationUser.create({ data: { organizationId: otherOrgId, userId: adminId, roleId: otherRoles.get('super_admin')!.id } })
    employeeId = (await createTestUser()).id
    const m = await testDb.organizationUser.create({ data: { organizationId: orgId, userId: employeeId, roleId: roles.get('employee')!.id } })
    await testDb.clientAssignment.create({ data: { clientId: assignedId, organizationUserId: m.id } })
    loneEmployeeId = (await createTestUser()).id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: loneEmployeeId, roleId: roles.get('employee')!.id } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [adminId, employeeId, loneEmployeeId])
    await cleanupOrg(otherOrgId, [])
  })

  it('honours a remembered client the caller can access', async () => {
    expect(await resolveLearnClientId(await ctxFor(employeeId), assignedId)).toBe(assignedId)
    expect(await resolveLearnClientId(await ctxFor(adminId), unassignedId)).toBe(unassignedId)
  })

  it('ignores a remembered client the employee is not assigned to', async () => {
    expect(await resolveLearnClientId(await ctxFor(employeeId), unassignedId)).toBe(assignedId)
  })

  it('ignores a client from another organisation, even for someone who is admin there', async () => {
    // Acting in orgId: the other org's client must not be opened.
    expect(await resolveLearnClientId(await ctxFor(adminId), foreignId)).not.toBe(foreignId)
  })

  it('ignores garbage and archived clients, falling back to the first active accessible one', async () => {
    const admin = await ctxFor(adminId)
    expect(await resolveLearnClientId(admin, 'not-a-real-id')).toBe(assignedId)
    expect(await resolveLearnClientId(admin, archivedId)).toBe(assignedId)
    expect(await resolveLearnClientId(admin, null)).toBe(assignedId)
  })

  it('returns null when the caller has no accessible client', async () => {
    expect(await resolveLearnClientId(await ctxFor(loneEmployeeId), unassignedId)).toBeNull()
  })
})
