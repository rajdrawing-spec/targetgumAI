import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db/client'
import { addClientContact, deleteClientContact, listClientContacts, updateClientContact } from '@/lib/clients/contacts'
import { createClient } from '@/lib/clients/create'
import { archiveClient, deleteClient, listAccountManagerCandidates, unarchiveClient, updateClientProfile } from '@/lib/clients/profile'
import { listClientsWithSummary } from '@/lib/clients/summary'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Phase 3 of the UX upgrade (docs/UX-ASSESSMENT.md §7): the client
 * profile lifecycle that did not exist before - update, archive,
 * unarchive, delete, contacts - and the one-query summary listing the
 * Clients page is built on. Authorization edge cases live in
 * tests/security/client-mutations.test.ts; this file covers behaviour.
 */
describe('Client profile lifecycle + summary listing', () => {
  let orgId: string
  let superAdminId: string
  let managerMembershipId: string
  const userIds: string[] = []

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    userIds.push(superAdminId)
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id } })
    const manager = await createTestUser()
    userIds.push(manager.id)
    managerMembershipId = (
      await testDb.organizationUser.create({ data: { organizationId: orgId, userId: manager.id, roleId: roles.get('account_manager')!.id } })
    ).id
  })

  afterAll(async () => {
    await cleanupOrg(orgId, userIds)
  })

  it('creates a client from the full onboarding payload in one go (profile, contacts, brain, competitors, policy)', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const client = await createClient(ctx, {
      name: 'ABC Dental',
      website: 'abcdental.example',
      industry: 'Dental',
      city: 'Chennai',
      country: 'India',
      accountManagerId: managerMembershipId,
      monthlyBudget: '2500',
      tags: ['healthcare', 'local'],
      contacts: [
        { name: 'Dr. Priya', email: 'priya@abcdental.example', isPrimary: true },
        { name: 'Front desk', phone: '+91 00000 00000', isPrimary: true }, // second primary is demoted
      ],
      brain: { business: { industry: 'Dental', productsServices: 'Implants, aligners' }, audience: {} },
      competitors: [{ name: 'Smile Co', url: 'https://smile.example' }],
      policy: { requireApprovalForCampaignLaunch: true, maxDailyAdBudget: 150 },
      internalNotes: 'Prefers WhatsApp for approvals.',
    })

    expect(client.website).toBe('https://abcdental.example')
    expect(client.accountManagerId).toBe(managerMembershipId)
    expect(client.monthlyBudget?.toNumber()).toBe(2500)
    expect(client.tags).toEqual(['healthcare', 'local'])

    const contacts = await listClientContacts(ctx, client.id)
    expect(contacts).toHaveLength(2)
    expect(contacts.filter((c) => c.isPrimary)).toHaveLength(1)
    expect(contacts[0]!.name).toBe('Dr. Priya')

    const brain = await db.clientBrain.findUnique({ where: { clientId: client.id } })
    expect(brain?.business).toMatchObject({ industry: 'Dental' })
    expect(brain?.audience).toBeNull() // empty section is not written

    expect(await db.clientCompetitor.count({ where: { clientId: client.id } })).toBe(1)
    const policy = await db.clientPolicy.findUnique({ where: { clientId: client.id } })
    expect(policy?.maxDailyAdBudget?.toNumber()).toBe(150)
    expect(await db.clientFeedback.count({ where: { clientId: client.id, source: 'ACCOUNT_MANAGER' } })).toBe(1)
    expect(await db.auditEvent.count({ where: { clientId: client.id, action: 'client.create' } })).toBe(1)
  })

  it('updates the profile, refuses a clashing name, and records an audit event', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const a = await createTestClient(orgId, 'Profile Client A')
    await createTestClient(orgId, 'Profile Client B')

    const updated = await updateClientProfile(ctx, a.id, { name: 'Profile Client A', industry: 'Retail', website: 'shop.example', automationLevel: 'APPROVAL_BASED' })
    expect(updated.industry).toBe('Retail')
    expect(updated.website).toBe('https://shop.example')
    expect(updated.automationLevel).toBe('APPROVAL_BASED')

    await expect(updateClientProfile(ctx, a.id, { name: 'profile client b' })).rejects.toThrow(/already exists/)
    await expect(updateClientProfile(ctx, a.id, { name: 'Profile Client A', website: 'not a url' })).rejects.toThrow()
    expect(await db.auditEvent.count({ where: { clientId: a.id, action: 'client.update' } })).toBe(1)
  })

  it('archive is a soft delete that keeps every row; unarchive restores ACTIVE', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const c = await createTestClient(orgId, 'Archive Me')
    await addClientContact(ctx, c.id, { name: 'Keeper' })

    const archived = await archiveClient(ctx, c.id)
    expect(archived.status).toBe('ARCHIVED')
    expect(archived.archivedAt).not.toBeNull()
    expect(await db.clientContact.count({ where: { clientId: c.id } })).toBe(1)
    await expect(updateClientProfile(ctx, c.id, { name: 'Archive Me', status: 'ACTIVE' })).rejects.toThrow(/Unarchive/)

    const restored = await unarchiveClient(ctx, c.id)
    expect(restored.status).toBe('ACTIVE')
    expect(restored.archivedAt).toBeNull()
  })

  it('delete requires the exact name, removes the client and its rows, and keeps the audit trail', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const c = await createTestClient(orgId, 'Delete Me')
    await addClientContact(ctx, c.id, { name: 'Gone' })

    await expect(deleteClient(ctx, c.id, 'delete me')).rejects.toThrow(/exact name/)
    expect(await db.client.findUnique({ where: { id: c.id } })).not.toBeNull()

    await deleteClient(ctx, c.id, 'Delete Me')
    expect(await db.client.findUnique({ where: { id: c.id } })).toBeNull()
    expect(await db.clientContact.count({ where: { clientId: c.id } })).toBe(0)
    const audit = await db.auditEvent.findFirst({ where: { organizationId: orgId, action: 'client.delete' }, orderBy: { timestamp: 'desc' } })
    expect(audit?.clientId).toBeNull() // relation set null, row kept
    expect(audit?.inputSummary).toMatchObject({ name: 'Delete Me' })
  })

  it('contacts: add / update / delete, with a single primary enforced', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const c = await createTestClient(orgId, 'Contacts Client')
    const first = await addClientContact(ctx, c.id, { name: 'One', isPrimary: true })
    const second = await addClientContact(ctx, c.id, { name: 'Two', email: 'two@example.test', isPrimary: true })
    let contacts = await listClientContacts(ctx, c.id)
    expect(contacts.find((x) => x.id === first.id)?.isPrimary).toBe(false)
    expect(contacts.find((x) => x.id === second.id)?.isPrimary).toBe(true)

    await updateClientContact(ctx, c.id, first.id, { name: 'One Updated', isPrimary: true })
    contacts = await listClientContacts(ctx, c.id)
    expect(contacts.filter((x) => x.isPrimary).map((x) => x.name)).toEqual(['One Updated'])

    await expect(addClientContact(ctx, c.id, { name: 'Bad', email: 'nope' })).rejects.toThrow()
    await deleteClientContact(ctx, c.id, second.id)
    expect(await listClientContacts(ctx, c.id)).toHaveLength(1)
  })

  it('summary listing: search, filters, attention counts, tenant scoping', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const a = await createClient(ctx, { name: 'Summary Alpha', industry: 'E-commerce', website: 'alpha.example', contacts: [{ name: 'Alice Contact', email: 'alice@alpha.example', isPrimary: true }] })
    const b = await createClient(ctx, { name: 'Summary Beta', industry: 'Education' })
    await testDb.approval.create({
      data: { organizationId: orgId, clientId: a.id, requestedBy: superAdminId, actionType: 'test', riskLevel: 'HIGH', actionSummary: 'pending thing', status: 'PENDING' },
    })
    await testDb.recommendation.create({
      data: { organizationId: orgId, clientId: a.id, priority: 'HIGH', area: 'Ads', finding: 'f', recommendation: 'r', status: 'RECOMMENDED' },
    })
    await archiveClient(ctx, b.id)

    const all = await listClientsWithSummary(ctx)
    expect(all.map((r) => r.name)).toContain('Summary Alpha')
    expect(all.map((r) => r.name)).not.toContain('Summary Beta') // archived hidden by default
    const alpha = all.find((r) => r.name === 'Summary Alpha')!
    expect(alpha.attention).toMatchObject({ pendingApprovals: 1, highPriorityRecommendations: 1, openTasks: 0, integrationIssues: 0 })
    expect(alpha.primaryContact?.name).toBe('Alice Contact')

    expect((await listClientsWithSummary(ctx, { status: 'ARCHIVED' })).map((r) => r.name)).toEqual(['Summary Beta'])
    expect((await listClientsWithSummary(ctx, { q: 'alice@alpha' })).map((r) => r.name)).toEqual(['Summary Alpha'])
    expect((await listClientsWithSummary(ctx, { q: 'e-comm' })).map((r) => r.name)).toEqual(['Summary Alpha'])
    expect((await listClientsWithSummary(ctx, { health: 'connected' })).length).toBe(0)
    const byAttention = await listClientsWithSummary(ctx, { sort: 'attention' })
    expect(byAttention[0]!.name).toBe('Summary Alpha')

    // A scoped role only sees its assigned clients in the summary.
    const employee = await createTestUser()
    userIds.push(employee.id)
    const roles = await testDb.role.findMany({ where: { organizationId: orgId } })
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employee.id, roleId: roles.find((r) => r.key === 'marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId: a.id, organizationUserId: membership.id } })
    const scoped = await listClientsWithSummary((await resolveAuthContext(testDb, employee.id, orgId))!, { status: 'ALL' })
    expect(scoped.map((r) => r.id)).toEqual([a.id])
  })

  it('account manager candidates are this organization\'s super admins and account managers only', async () => {
    const ctx = (await resolveAuthContext(testDb, superAdminId, orgId))!
    const candidates = await listAccountManagerCandidates(ctx)
    expect(candidates.map((c) => c.roleKey).sort()).toEqual(expect.arrayContaining(['account_manager', 'super_admin']))
    expect(candidates.some((c) => c.roleKey === 'marketing_employee')).toBe(false)
  })
})
