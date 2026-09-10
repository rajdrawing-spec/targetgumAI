import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import { registerGA4Tools } from '@/lib/integrations/ga4/tools'
import { registerGSCTools } from '@/lib/integrations/gsc/tools'
import { resolveAuthContext } from '@/lib/rbac/context'
import { executeTool } from '@/lib/tools/execute'
import { db } from '@/lib/db/client'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * End-to-end through the exact executeTool() path an agent would use. No
 * GA4_OAUTH_CLIENT_ID/SECRET or GSC_OAUTH_CLIENT_ID/SECRET are configured
 * in this test environment, so resolveGA4Provider/resolveGSCProvider
 * resolve to their mock providers - see docs/EXTERNAL-APPROVALS.md.
 */
describe('GA4 + GSC tools end-to-end (connection/health + Tool Registry + mock providers)', () => {
  let orgId: string
  let clientId: string
  let disconnectedClientId: string
  let userId: string

  beforeAll(async () => {
    await registerGA4Tools()
    await registerGSCTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'GA4/GSC E2E Client')
    clientId = client.id
    const disconnectedClient = await createTestClient(orgId, 'Disconnected Client')
    disconnectedClientId = disconnectedClient.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    const ga4Connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'GA4',
      externalAccountId: '999999',
      label: 'Mock GA4 Property',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(ga4Connection.id)

    const gscConnection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'GOOGLE_SEARCH_CONSOLE',
      externalAccountId: 'https://example.com/',
      label: 'Mock GSC Property',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(gscConnection.id)
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({
      where: { tool: { key: { in: ['ga4.get_report', 'gsc.get_search_performance'] } } },
    })
    await cleanupOrg(orgId, [userId])
  })

  it('ga4.get_report runs through the full authorization + integration-health chain and returns mock data', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = (await executeTool({
      ctx: ctx!,
      toolKey: 'ga4.get_report',
      input: { dimensions: ['date'], metrics: ['sessions'], from: '2026-01-01', to: '2026-01-31' },
      clientId,
    })) as Array<{ source: string }>
    expect(result[0]?.source).toBe('ga4-mock')

    const execution = await db.toolExecution.findFirst({
      where: { organizationId: orgId, clientId, tool: { key: 'ga4.get_report' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(execution?.status).toBe('SUCCEEDED')
  })

  it('gsc.get_search_performance runs through the full chain and returns mock data', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = (await executeTool({
      ctx: ctx!,
      toolKey: 'gsc.get_search_performance',
      input: { dimensions: ['query'], from: '2026-01-01', to: '2026-01-31' },
      clientId,
    })) as Array<{ source: string }>
    expect(result[0]?.source).toBe('gsc-mock')
  })

  it('denies (IntegrationUnavailableError) rather than fabricating data for a client with no GA4 connection', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    await expect(
      executeTool({
        ctx: ctx!,
        toolKey: 'ga4.get_report',
        input: { dimensions: ['date'], metrics: ['sessions'], from: '2026-01-01', to: '2026-01-31' },
        clientId: disconnectedClientId,
      }),
    ).rejects.toThrow(IntegrationUnavailableError)
  })

  it('denies (IntegrationUnavailableError) rather than fabricating data for a client with no GSC connection', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    await expect(
      executeTool({
        ctx: ctx!,
        toolKey: 'gsc.get_search_performance',
        input: { dimensions: ['query'], from: '2026-01-01', to: '2026-01-31' },
        clientId: disconnectedClientId,
      }),
    ).rejects.toThrow(IntegrationUnavailableError)
  })
})
