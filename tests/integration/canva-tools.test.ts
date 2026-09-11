import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectClientToCanvaAccount } from '@/lib/integrations/canva/connect'
import { registerCanvaTools } from '@/lib/integrations/canva/tools'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { executeTool } from '@/lib/tools/execute'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Canva Tool Registry entries (Phase 2, BRD Section 17/85). Unlike native
 * Ads (`ads.manage`, `account_manager` only), `creative.manage` is granted
 * to both `account_manager` and `marketing_employee` (BRD 4.3 explicitly
 * lists "Generate creative briefs" for Marketing Employee) - see
 * docs/DECISIONS.md.
 */
describe('Canva tools end-to-end (Tool Registry + creative.manage)', () => {
  let orgId: string
  let clientId: string
  let disconnectedClientId: string
  let superAdminId: string
  let marketingEmployeeId: string
  let clientUserId: string

  beforeAll(async () => {
    await registerCanvaTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Canva E2E Client')
    clientId = client.id
    const disconnectedClient = await createTestClient(orgId, 'Canva Disconnected Client')
    disconnectedClientId = disconnectedClient.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const marketingEmployee = await createTestUser()
    marketingEmployeeId = marketingEmployee.id
    const meMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: marketingEmployeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: meMembership.id } })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    await connectClientToCanvaAccount(superAdminCtx!, clientId, 'mock-canva-brand-1', 'E2E Mock Brand')
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: { startsWith: 'canva.' } } } })
    await cleanupOrg(orgId, [superAdminId, marketingEmployeeId, clientUserId])
  })

  it('the connect flow marks the connection CONNECTED (verified against the mock provider, not assumed)', async () => {
    const connection = await db.integrationConnection.findFirst({
      where: { clientId, integrationAccount: { integration: { provider: 'CANVA' } } },
    })
    expect(connection?.status).toBe('CONNECTED')
  })

  it('canva.create_design (MEDIUM) executes directly for marketing_employee (creative.manage, unlike ads.manage, is granted to this role)', async () => {
    const ctx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const design = (await executeTool({
      ctx: ctx!,
      toolKey: 'canva.create_design',
      input: { title: 'New Concept', concept: 'A bold product shot', copy: 'Buy now', platform: 'instagram' },
      clientId,
    })) as { providerDesignId: string; designUrl: string }
    expect(design.designUrl).toContain('canva.com')
  })

  it('canva.create_design/edit_design/export_design are denied for client_user (no creative.manage)', async () => {
    const ctx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'canva.create_design', input: { title: 't', concept: 'c', platform: 'instagram' }, clientId }),
    ).rejects.toThrow(ForbiddenError)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'canva.edit_design', input: { providerDesignId: 'x' }, clientId }),
    ).rejects.toThrow(ForbiddenError)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'canva.export_design', input: { providerDesignId: 'x' }, clientId }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('canva.search_designs/search_assets (LOW) work for any role holding clients.read - even client_user', async () => {
    const ctx = await resolveAuthContext(testDb, clientUserId, orgId)
    const designs = await executeTool({ ctx: ctx!, toolKey: 'canva.search_designs', input: { query: '' }, clientId })
    expect(Array.isArray(designs)).toBe(true)

    const assets = (await executeTool({
      ctx: ctx!,
      toolKey: 'canva.search_assets',
      input: { query: 'brand mark' },
      clientId,
    })) as Array<{ title: string }>
    expect(assets.length).toBeGreaterThan(0)
  })

  it('denies (as IntegrationUnavailableError) rather than fabricating data for a client with no Canva connection', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'canva.search_designs', input: { query: '' }, clientId: disconnectedClientId }),
    ).rejects.toThrow(IntegrationUnavailableError)
  })
})
