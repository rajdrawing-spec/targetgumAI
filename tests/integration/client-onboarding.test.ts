import type { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/clients/create'
import { db } from '@/lib/db/client'
import { connectClientToMetricoolBrand } from '@/lib/integrations/metricool/connect'
import { resetMetricoolClientForTests, setMetricoolClientForTests } from '@/lib/integrations/metricool/mcp-client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Day 15 pilot-readiness gap: up to Day 14, no code path in the app itself
 * could create a real client or connect it to Metricool - only
 * prisma/seed.ts and test factories could. `createClient`
 * (src/lib/clients/create.ts) and `connectClientToMetricoolBrand`
 * (src/lib/integrations/metricool/connect.ts) close that gap; this file
 * verifies both against the MVP Exit Criteria's "Real client can be
 * created" (BRD Section 84).
 */

function textResult(data: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

describe('Client onboarding (Day 15) - createClient + connectClientToMetricoolBrand', () => {
  let orgId: string
  let superAdminId: string
  let employeeId: string // marketing_employee: lacks clients.manage and integrations.manage

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const employee = await createTestUser()
    employeeId = employee.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('marketing_employee')!.id },
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId])
  })

  afterEach(() => {
    resetMetricoolClientForTests()
    delete process.env.METRICOOL_MCP_URL
    vi.restoreAllMocks()
  })

  describe('createClient', () => {
    it('denies a role without clients.manage (marketing_employee)', async () => {
      const ctx = await resolveAuthContext(testDb, employeeId, orgId)
      await expect(createClient(ctx!, { name: 'Should Not Exist' })).rejects.toThrow(ForbiddenError)
    })

    it('creates a real Client row with a default ClientPolicy, tenant-scoped to the caller\'s org', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const client = await createClient(ctx!, { name: 'Real Pilot Client' })

      expect(client.organizationId).toBe(orgId)
      expect(client.name).toBe('Real Pilot Client')
      expect(client.slug).toBe('real-pilot-client')

      const policy = await db.clientPolicy.findUnique({ where: { clientId: client.id } })
      expect(policy).not.toBeNull()
    })

    it('auto-suffixes the slug on a collision within the same org, rather than failing', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const first = await createClient(ctx!, { name: 'Collision Co' })
      const second = await createClient(ctx!, { name: 'Collision Co' })

      expect(first.slug).toBe('collision-co')
      expect(second.slug).toBe('collision-co-2')
      expect(second.id).not.toBe(first.id)
    })

    it('rejects an empty/whitespace-only name', async () => {
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      await expect(createClient(ctx!, { name: '   ' })).rejects.toThrow(/name is required/)
    })
  })

  describe('connectClientToMetricoolBrand', () => {
    it('denies a role without integrations.manage', async () => {
      const client = await createTestClient(orgId, 'Onboarding Client A')
      const ctx = await resolveAuthContext(testDb, employeeId, orgId)
      await expect(connectClientToMetricoolBrand(ctx!, client.id, '123456')).rejects.toThrow(ForbiddenError)
    })

    it('creates a CONNECTED connection when the brand is real (verified via a live getConnectedNetworks call, not trusted blindly)', async () => {
      process.env.METRICOOL_MCP_URL = 'https://mcp.example.test/metricool'
      const callTool = vi.fn()
      setMetricoolClientForTests({ callTool } as unknown as McpClient)
      callTool.mockResolvedValueOnce(
        textResult([{ id: 999111, label: 'Real Brand', networksData: { instagramData: 'handle' } }]),
      )

      const client = await createTestClient(orgId, 'Onboarding Client B')
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const connection = await connectClientToMetricoolBrand(ctx!, client.id, '999111', 'Real Brand')

      expect(connection.clientId).toBe(client.id)
      const stored = await db.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } })
      expect(stored.status).toBe('CONNECTED')
      expect(stored.lastSuccessfulSyncAt).not.toBeNull()
    })

    it('marks the connection ERROR (with the real message), not CONNECTED, when the brand id is rejected by Metricool', async () => {
      process.env.METRICOOL_MCP_URL = 'https://mcp.example.test/metricool'
      const callTool = vi.fn()
      setMetricoolClientForTests({ callTool } as unknown as McpClient)
      callTool.mockResolvedValueOnce(textResult([{ id: 1, label: 'Some Other Brand', networksData: {} }]))

      const client = await createTestClient(orgId, 'Onboarding Client C')
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const connection = await connectClientToMetricoolBrand(ctx!, client.id, '404404', undefined)

      const stored = await db.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } })
      expect(stored.status).toBe('ERROR')
      expect(stored.lastErrorMessage).toContain('No Metricool brand found')
    })

    it('denies connecting a client outside the caller\'s authorized set', async () => {
      const otherOrg = await createTestOrg()
      const outsideClient = await createTestClient(otherOrg.id, 'Outside Client')
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId) // super_admin of a DIFFERENT org
      await expect(connectClientToMetricoolBrand(ctx!, outsideClient.id, '1')).rejects.toThrow(ForbiddenError)
      await cleanupOrg(otherOrg.id, [])
    })
  })
})
