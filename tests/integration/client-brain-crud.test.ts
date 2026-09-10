import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  addClientBrandAsset,
  addClientCompetitor,
  addClientFeedback,
  getClientBrainSection,
  getClientPolicy,
  listClientBrandAssets,
  listClientCompetitors,
  listClientFeedback,
  updateClientBrainSection,
  updateClientPolicy,
} from '@/lib/clients/brain'
import { ForbiddenError } from '@/lib/rbac/errors'
import { resolveAuthContext } from '@/lib/rbac/context'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

describe('Client Brain CRUD (BRD Section 6) - tenant + permission enforced throughout', () => {
  let orgId: string
  let clientAId: string
  let clientBId: string
  let superAdminId: string
  let employeeId: string // marketing_employee, assigned to Client A only

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
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({
      data: { clientId: clientAId, organizationUserId: membership.id },
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId])
  })

  it('updateClientBrainSection validates input and writes only the targeted section', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await updateClientBrainSection(ctx!, clientAId, 'business', {
      companyName: 'Acme Corp',
      industry: 'Retail',
    })
    await updateClientBrainSection(ctx!, clientAId, 'brand', { voice: 'Friendly' })

    const business = await getClientBrainSection(ctx!, clientAId, 'business')
    expect(business).toMatchObject({ companyName: 'Acme Corp', industry: 'Retail' })

    const brand = await getClientBrainSection(ctx!, clientAId, 'brand')
    expect(brand).toMatchObject({ voice: 'Friendly' })

    // Sections not yet written are still null, not accidentally populated.
    const audience = await getClientBrainSection(ctx!, clientAId, 'audience')
    expect(audience).toBeNull()
  })

  it('updateClientBrainSection rejects invalid data with a ZodError, writing nothing', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(
      updateClientBrainSection(ctx!, clientAId, 'business', { companyName: 12345 }),
    ).rejects.toThrow(z.ZodError)
  })

  it('denies a client_user-adjacent role without clients.manage from writing the brain', async () => {
    // marketing_employee lacks clients.manage in the seeded permission set.
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    await expect(
      updateClientBrainSection(ctx!, clientAId, 'business', { companyName: 'Should not save' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('denies cross-client access even for brain reads', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId) // assigned to Client A only
    await expect(getClientBrainSection(ctx!, clientBId, 'business')).rejects.toThrow(ForbiddenError)
  })

  it('brand assets: add + list, tenant-scoped', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await addClientBrandAsset(ctx!, clientAId, { type: 'LOGO', label: 'Primary logo', url: 'https://example.com/logo.png' })
    const assets = await listClientBrandAssets(ctx!, clientAId)
    expect(assets).toHaveLength(1)
    expect(assets[0]?.label).toBe('Primary logo')

    const otherClientAssets = await listClientBrandAssets(ctx!, clientBId)
    expect(otherClientAssets).toHaveLength(0)
  })

  it('competitors: add + list', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await addClientCompetitor(ctx!, clientAId, { name: 'Competitor X', url: 'https://competitor-x.test' })
    const competitors = await listClientCompetitors(ctx!, clientAId)
    expect(competitors.some((c) => c.name === 'Competitor X')).toBe(true)
  })

  it('policy: update respects max budget fields and tenant scoping', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await updateClientPolicy(ctx!, clientAId, { maxDailyAdBudget: 500, maxBudgetChangePercent: 15 })
    const policy = await getClientPolicy(ctx!, clientAId)
    expect(policy?.maxDailyAdBudget?.toNumber()).toBe(500)
    expect(policy?.maxBudgetChangePercent).toBe(15)
  })

  it('feedback: add + list, most recent first', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await addClientFeedback(ctx!, clientAId, {
      category: 'REJECTED_PATTERN',
      content: 'Client dislikes bright yellow CTAs',
      source: 'ACCOUNT_MANAGER',
    })
    const feedback = await listClientFeedback(ctx!, clientAId)
    expect(feedback[0]?.content).toContain('bright yellow')
  })
})
