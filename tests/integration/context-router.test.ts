import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addClientCompetitor, addClientFeedback, updateClientBrainSection, updateClientPolicy } from '@/lib/clients/brain'
import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

describe('Context Router (BRD Section 7) - assembles only the relevant Client Brain slice', () => {
  let orgId: string
  let clientId: string
  let otherClientId: string
  let superAdminId: string
  let employeeId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Context Router Client')
    clientId = client.id
    const otherClient = await createTestClient(orgId, 'Other Client')
    otherClientId = otherClient.id

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
      data: { clientId, organizationUserId: membership.id },
    })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await updateClientBrainSection(ctx!, clientId, 'business', { companyName: 'Router Test Co' })
    await updateClientBrainSection(ctx!, clientId, 'audience', { demographics: 'Adults 25-45' })
    await updateClientBrainSection(ctx!, clientId, 'brand', { voice: 'Bold' })
    await updateClientBrainSection(ctx!, clientId, 'marketing', { objectives: ['Grow leads'] })
    await updateClientPolicy(ctx!, clientId, { maxDailyAdBudget: 200 })
    await addClientCompetitor(ctx!, clientId, { name: 'Rival Inc' })
    await addClientFeedback(ctx!, clientId, {
      category: 'APPROVED_PATTERN',
      content: 'Client likes short, punchy captions',
      source: 'ACCOUNT_MANAGER',
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId])
  })

  it('"analytics" category includes business+marketing and competitors, excludes audience/brand', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const context = await assembleClientContext(ctx!, clientId, 'analytics')

    expect(context.brain.business).toMatchObject({ companyName: 'Router Test Co' })
    expect(context.brain.marketing).toMatchObject({ objectives: ['Grow leads'] })
    expect(context.brain.audience).toBeUndefined()
    expect(context.brain.brand).toBeUndefined()
    expect(context.competitors?.some((c) => c.name === 'Rival Inc')).toBe(true)
    expect(context.policy?.maxDailyAdBudget).toBe(200)
  })

  it('"content" category includes business+audience+brand, excludes marketing and competitors', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const context = await assembleClientContext(ctx!, clientId, 'content')

    expect(context.brain.business).toMatchObject({ companyName: 'Router Test Co' })
    expect(context.brain.audience).toMatchObject({ demographics: 'Adults 25-45' })
    expect(context.brain.brand).toMatchObject({ voice: 'Bold' })
    expect(context.brain.marketing).toBeUndefined()
    expect(context.competitors).toBeUndefined() // not assembled outside "analytics"
  })

  it('always includes recent feedback regardless of category', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const context = await assembleClientContext(ctx!, clientId, 'reporting')
    expect(context.recentFeedback.some((f) => f.content.includes('punchy captions'))).toBe(true)
  })

  it('denies assembling context for a client outside the caller\'s access', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId) // assigned to `clientId` only
    await expect(assembleClientContext(ctx!, otherClientId, 'analytics')).rejects.toThrow(ForbiddenError)
  })

  it('renderContextAsText produces a text block containing the assembled sections, not the whole brain', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const context = await assembleClientContext(ctx!, clientId, 'content')
    const text = renderContextAsText(context)

    expect(text).toContain('Router Test Co')
    expect(text).toContain('Bold')
    expect(text).not.toContain('Grow leads') // marketing section excluded from "content"
  })
})
