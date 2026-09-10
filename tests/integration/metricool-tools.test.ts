import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import { registerMetricoolTools } from '@/lib/integrations/metricool/tools'
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
 * End-to-end: Tool Registry (Day 5) + Integration connection/health (Day 6)
 * + MetricoolMockProvider, exercised through the exact same executeTool()
 * path a real agent would use. No METRICOOL_MCP_URL is set in this test
 * environment, so getMetricoolProvider() resolves to the mock - see
 * docs/EXTERNAL-APPROVALS.md for why the real adapter isn't live-tested here.
 */
describe('Metricool tools end-to-end (Tool Registry + integration health + mock provider)', () => {
  let orgId: string
  let clientId: string
  let disconnectedClientId: string
  let userId: string

  beforeAll(async () => {
    await registerMetricoolTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Metricool E2E Client')
    clientId = client.id
    const disconnectedClient = await createTestClient(orgId, 'Disconnected Client')
    disconnectedClientId = disconnectedClient.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'METRICOOL',
      externalAccountId: 'mock-brand-e2e',
      label: 'E2E Mock Brand',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(connection.id)
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: { startsWith: 'metricool.' } } } })
    await cleanupOrg(orgId, [userId])
  })

  it('metricool.get_connected_networks returns the mock provider data via the full authorization + execution chain', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = (await executeTool({
      ctx: ctx!,
      toolKey: 'metricool.get_connected_networks',
      input: {},
      clientId,
    })) as Array<{ network: string }>
    expect(result.length).toBeGreaterThan(0)

    const execution = await db.toolExecution.findFirst({
      where: { organizationId: orgId, clientId, tool: { key: 'metricool.get_connected_networks' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(execution?.status).toBe('SUCCEEDED')
  })

  it('metricool.schedule_post creates a draft post and metricool.get_posts lists it', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const scheduled = (await executeTool({
      ctx: ctx!,
      toolKey: 'metricool.schedule_post',
      input: { networks: ['instagram'], text: 'Test post', scheduledAt: '2026-03-01T10:00:00Z' },
      clientId,
    })) as { providerPostId: string; status: string }
    expect(scheduled.status).toBe('scheduled')

    const posts = (await executeTool({
      ctx: ctx!,
      toolKey: 'metricool.get_posts',
      input: { from: '2026-01-01', to: '2026-12-31' },
      clientId,
    })) as Array<{ providerPostId: string }>
    expect(posts.some((p) => p.providerPostId === scheduled.providerPostId)).toBe(true)
  })

  it('metricool.get_social_analytics and metricool.get_ad_campaigns / get_ad_performance return normalized data with provenance', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const analytics = (await executeTool({
      ctx: ctx!,
      toolKey: 'metricool.get_social_analytics',
      input: { network: 'instagram', from: '2026-01-01', to: '2026-01-31' },
      clientId,
    })) as Array<{ source: string }>
    expect(analytics[0]?.source).toBe('metricool-mock')

    const campaigns = (await executeTool({
      ctx: ctx!,
      toolKey: 'metricool.get_ad_campaigns',
      input: { channel: 'googleAds' },
      clientId,
    })) as Array<{ channel: string }>
    expect(campaigns.every((c) => c.channel === 'googleAds')).toBe(true)

    const performance = (await executeTool({
      ctx: ctx!,
      toolKey: 'metricool.get_ad_performance',
      input: { channel: 'googleAds', from: '2026-01-01', to: '2026-01-31' },
      clientId,
    })) as Array<{ source: string }>
    expect(performance[0]?.source).toBe('metricool-mock')
  })

  it('denies (as IntegrationUnavailableError) rather than fabricating data for a client with no Metricool connection', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    await expect(
      executeTool({
        ctx: ctx!,
        toolKey: 'metricool.get_connected_networks',
        input: {},
        clientId: disconnectedClientId,
      }),
    ).rejects.toThrow(IntegrationUnavailableError)
  })

  it('metricool.update_ad_campaign is deliberately NOT registered (no Metricool write endpoint exists)', async () => {
    const tool = await db.tool.findFirst({ where: { key: 'metricool.update_ad_campaign' } })
    expect(tool).toBeNull()
  })
})
