import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import {
  MARKETING_ANALYTICS_AGENT_KEY,
  registerMarketingAnalyticsAgent,
  runMarketingAnalysis,
} from '@/lib/agents/analytics-agent'
import { db } from '@/lib/db/client'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { registerGA4Tools } from '@/lib/integrations/ga4/tools'
import { registerGSCTools } from '@/lib/integrations/gsc/tools'
import { registerMetricoolTools } from '@/lib/integrations/metricool/tools'
import { resolveAuthContext } from '@/lib/rbac/context'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

const VALID_ANALYSIS_OUTPUT = {
  summary: 'Overall performance is steady; one campaign is underperforming on CPA.',
  recommendations: [
    {
      priority: 'HIGH',
      area: 'Google Ads',
      finding: 'CPA on Mock Search Campaign is above target.',
      evidence: ['spend: 420.5', 'conversions: 34', 'cpa: 12.37'],
      likelyCause: 'Broad match keywords driving low-intent clicks.',
      recommendation: 'Review search terms and tighten match types.',
      expectedImpact: 'Lower CPA by an estimated 15-20%.',
      confidence: 0.72,
      requiresApproval: true,
    },
  ],
}

function fakeUsage() {
  return {
    input_tokens: 500,
    output_tokens: 300,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    cache_creation: null,
    inference_geo: null,
    server_tool_use: null,
    service_tier: null,
  }
}

function mockClaudeParse() {
  const parse = vi.fn()
  const fakeClient = { messages: { parse } } as unknown as Anthropic
  setAnthropicClientForTests(fakeClient)
  return parse
}

describe('Marketing Analytics Agent (Day 9) - AI Gateway + Tool Registry + Context Router, end to end', () => {
  let orgId: string
  let clientId: string
  let noConnectionsClientId: string
  let userId: string

  beforeAll(async () => {
    await registerMetricoolTools()
    await registerGA4Tools()
    await registerGSCTools()
    await registerMarketingAnalyticsAgent()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Analytics Agent Client')
    clientId = client.id
    const noConnectionsClient = await createTestClient(orgId, 'No Connections Client')
    noConnectionsClientId = noConnectionsClient.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    for (const [provider, externalId] of [
      ['METRICOOL', 'mock-brand-analytics'],
      ['GA4', '999999'],
      ['GOOGLE_SEARCH_CONSOLE', 'https://example.com/'],
    ] as const) {
      const connection = await connectClientToProviderAccount({
        organizationId: orgId,
        clientId,
        provider,
        externalAccountId: externalId,
        createdBy: 'test',
      })
      await recordIntegrationSuccess(connection.id)
    }
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { agentId: { not: null } } })
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await db.agentTool.deleteMany({ where: { agent: { key: MARKETING_ANALYTICS_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: MARKETING_ANALYTICS_AGENT_KEY } })
    await cleanupOrg(orgId, [userId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('registers the agent with exactly its intended, all-LOW-risk tool allowlist', async () => {
    const agent = await db.agent.findFirstOrThrow({ where: { key: MARKETING_ANALYTICS_AGENT_KEY } })
    const agentTools = await db.agentTool.findMany({ where: { agentId: agent.id }, include: { tool: true } })
    const toolKeys = agentTools.map((at) => at.tool.key).sort()

    expect(toolKeys).toEqual(
      [
        'ga4.get_report',
        'gsc.get_search_performance',
        'metricool.get_ad_campaigns',
        'metricool.get_ad_performance',
        'metricool.get_social_analytics',
      ].sort(),
    )
    expect(agentTools.every((at) => at.tool.riskLevel === 'LOW')).toBe(true)
  })

  it('runs the full pipeline: Context Router + real-time data gathering + AI Gateway, returns structured recommendations', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_ANALYSIS_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await runMarketingAnalysis({
      ctx: ctx!,
      clientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
      socialNetwork: 'instagram',
      adsChannel: 'googleAds',
    })

    expect(result.summary).toBe(VALID_ANALYSIS_OUTPUT.summary)
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]?.priority).toBe('HIGH')
    expect(result.dataGaps).toHaveLength(0)
    expect(result.aiRunId).toBeTruthy()

    // The userMessage sent to Claude actually contains the gathered data and brain context.
    const call = parse.mock.calls[0]![0] as { system: string; messages: Array<{ content: string }> }
    expect(call.system).toContain('Marketing Analytics Agent') // from prompts/analytics/v1.md
    expect(call.messages[0]?.content).toContain('Client:')
    expect(call.messages[0]?.content).toContain('Ad campaigns (googleAds)')

    // Tool executions and the ai_run were both recorded, attributed to this agent.
    const executions = await db.toolExecution.findMany({
      where: { organizationId: orgId, clientId, agent: { key: MARKETING_ANALYTICS_AGENT_KEY } },
    })
    expect(executions.length).toBeGreaterThanOrEqual(5)
    expect(executions.every((e) => e.status === 'SUCCEEDED')).toBe(true)

    const aiRun = await db.aiRun.findUniqueOrThrow({ where: { id: result.aiRunId! } })
    expect(aiRun.status).toBe('SUCCEEDED')
    expect(aiRun.clientId).toBe(clientId)
  })

  it('reports partial data gaps without failing the whole run when only some integrations are connected', async () => {
    const partialClient = await createTestClient(orgId, 'Partial Connections Client')
    const metricoolConnection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId: partialClient.id,
      provider: 'METRICOOL',
      externalAccountId: 'mock-brand-partial',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(metricoolConnection.id)
    // GA4/GSC deliberately left unconnected for this client.

    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_ANALYSIS_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await runMarketingAnalysis({
      ctx: ctx!,
      clientId: partialClient.id,
      range: { from: '2026-01-01', to: '2026-01-31' },
      socialNetwork: 'instagram',
      adsChannel: 'googleAds',
    })

    expect(result.aiRunId).toBeTruthy() // still ran - Metricool data was available
    expect(result.dataGaps.some((gap) => gap.startsWith('GA4 report'))).toBe(true)
    expect(result.dataGaps.some((gap) => gap.startsWith('Search Console performance'))).toBe(true)

    await db.toolExecution.deleteMany({ where: { clientId: partialClient.id } })
  })

  it('never calls Claude and returns aiRunId: null when every data source is unavailable (no fabricated analysis)', async () => {
    const parse = mockClaudeParse()

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await runMarketingAnalysis({
      ctx: ctx!,
      clientId: noConnectionsClientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
      socialNetwork: 'instagram',
      adsChannel: 'googleAds',
    })

    expect(result.aiRunId).toBeNull()
    expect(result.recommendations).toHaveLength(0)
    expect(result.dataGaps).toHaveLength(5) // all five tools failed
    expect(parse).not.toHaveBeenCalled() // no AI spend on an all-gaps input
  })
})
