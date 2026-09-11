import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db/client'
import { addClientContact } from '@/lib/clients/contacts'
import { createClient } from '@/lib/clients/create'
import { archiveClient, deleteClient, unarchiveClient, updateClientProfile } from '@/lib/clients/profile'
import { listClientsWithSummary } from '@/lib/clients/summary'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * BRD-PRD Section 80 scenario 1 ("user assigned to Client A requests
 * Client B") and scenario 5 ("unauthorized change attempt -> denied, no
 * partial execution") applied to every new client mutation from the UX
 * upgrade. Rules under test (docs/DECISIONS.md):
 *   - profile / contact edits: `clients.edit` + an authorized client
 *   - archive / unarchive / delete: `clients.manage` (Super Admin)
 *   - a Super Admin of ANOTHER organization is denied everywhere
 *   - the account manager must be a member of the same organization
 */
describe('security: client mutations respect role, permission, assignment and organization', () => {
  let orgId: string
  let otherOrgId: string
  let superAdminId: string
  let otherSuperAdminId: string
  let managerId: string
  let employeeId: string
  let clientAId: string
  let clientBId: string
  let foreignClientId: string
  let foreignMembershipId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    clientAId = (await createTestClient(orgId, 'Mut Client A')).id
    clientBId = (await createTestClient(orgId, 'Mut Client B')).id

    superAdminId = (await createTestUser()).id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id } })

    managerId = (await createTestUser()).id
    const managerMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: managerId, roleId: roles.get('account_manager')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId: clientAId, organizationUserId: managerMembership.id } })

    employeeId = (await createTestUser()).id
    const employeeMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId: clientAId, organizationUserId: employeeMembership.id } })

    const otherOrg = await createTestOrg()
    otherOrgId = otherOrg.id
    const otherRoles = await createSystemRoles(otherOrgId)
    foreignClientId = (await createTestClient(otherOrgId, 'Foreign Client')).id
    otherSuperAdminId = (await createTestUser()).id
    foreignMembershipId = (
      await testDb.organizationUser.create({ data: { organizationId: otherOrgId, userId: otherSuperAdminId, roleId: otherRoles.get('super_admin')!.id } })
    ).id
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, managerId, employeeId])
    await cleanupOrg(otherOrgId, [otherSuperAdminId])
  })

  it('marketing_employee (no clients.edit) cannot update a client it is assigned to', async () => {
    const ctx = (await resolveAuthContext(testDb, employeeId, orgId))!
    await expect(updateClientProfile(ctx, clientAId, { name: 'Mut Client A', industry: 'X' })).rejects.toThrow(ForbiddenError)
    await expect(addClientContact(ctx, clientAId, { name: 'Nope' })).rejects.toThrow(ForbiddenError)
    expect((await db.client.findUniqueOrThrow({ where: { id: clientAId } })).industry).toBeNull()
  })

  it('account_manager can edit its assigned client but not an unassigned one in the same org', async () => {
    const ctx = (await resolveAuthContext(testDb, managerId, orgId))!
    const updated = await updateClientProfile(ctx, clientAId, { name: 'Mut Client A', industry: 'Retail' })
    expect(updated.industry).toBe('Retail')
    await expect(updateClientProfile(ctx, clientBId, { name: 'Mut Client B', industry: 'Retail' })).rejects.toThrow(ForbiddenError)
    await expect(addClientContact(ctx, clientBId, { name: 'Nope' })).rejects.toThrow(ForbiddenError)
  })

  it('archive / unarchive / delete need clients.manage - account_manager is denied even on its own client', async () => {
    const ctx = (await resolveAuthContext(testDb, managerId, orgId))!
    await expect(archiveClient(ctx, clientAId)).rejects.toThrow(ForbiddenError)
    await expect(unarchiveClient(ctx, clientAId)).rejects.toThrow(ForbiddenError)
    await expect(deleteClient(ctx, clientAId, 'Mut Client A')).rejects.toThrow(ForbiddenError)
    expect(await db.client.findUnique({ where: { id: clientAId } })).not.toBeNull()
  })

  it('a super_admin of another organization is denied on every mutation, with the same error as a missing client', async () => {
    const foreignCtx = (await resolveAuthContext(testDb, otherSuperAdminId, otherOrgId))!
    await expect(updateClientProfile(foreignCtx, clientAId, { name: 'Hijack' })).rejects.toThrow(ForbiddenError)
    await expect(archiveClient(foreignCtx, clientAId)).rejects.toThrow(ForbiddenError)
    await expect(deleteClient(foreignCtx, clientAId, 'Mut Client A')).rejects.toThrow(ForbiddenError)
    await expect(addClientContact(foreignCtx, clientAId, { name: 'Nope' })).rejects.toThrow(ForbiddenError)
    await expect(updateClientProfile(foreignCtx, 'does-not-exist', { name: 'Hijack' })).rejects.toThrow(ForbiddenError)
    expect((await db.client.findUniqueOrThrow({ where: { id: clientAId } })).name).toBe('Mut Client A')
  })

  it('the account manager must belong to the same organization (create and update)', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    await expect(createClient(ctx, { name: 'AM Check', accountManagerId: foreignMembershipId })).rejects.toThrow(/not a member/)
    await expect(updateClientProfile(ctx, clientBId, { name: 'Mut Client B', accountManagerId: foreignMembershipId })).rejects.toThrow(ForbiddenError)
    expect(await db.client.findFirst({ where: { organizationId: orgId, name: 'AM Check' } })).toBeNull()
  })

  it('the summary listing never includes another organization\'s client, even when searched for by name', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const rows = await listClientsWithSummary(ctx, { q: 'Foreign', status: 'ALL' })
    expect(rows.map((r) => r.id)).not.toContain(foreignClientId)
  })
})
