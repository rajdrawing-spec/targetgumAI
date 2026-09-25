import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { registerMarketingAnalyticsAgent, runMarketingAnalysis } from '@/lib/agents/analytics-agent'
import { SEO_AGENT_KEY, registerSeoAgent, runSeoAnalysis } from '@/lib/agents/seo-agent'
import { db } from '@/lib/db/client'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { registerGA4Tools } from '@/lib/integrations/ga4/tools'
import { registerGSCTools } from '@/lib/integrations/gsc/tools'
import { registerMetricoolTools } from '@/lib/integrations/metricool/tools'
import { listSeoRecommendations, listSeoRecommendationsForOrg } from '@/lib/seo/persist'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { runSeoAnalysisWorkflow } from '@/lib/workflows/seo-analysis-workflow'
import { registerGoogleAdsTools } from '@/lib/integrations/google-ads/tools'
import { registerMetaAdsTools } from '@/lib/integrations/meta-ads/tools'
import { registerAmazonAdsTools } from '@/lib/integrations/amazon-ads/tools'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * SEO Agent + "Run SEO analysis" workflow (BRD Section 25's "Later: SEO
 * Agent", built now as a Phase 2 item - Section 85). docs/DECISIONS.md has
 * the full design rationale.
 */

const VALID_SEO_OUTPUT = {
  summary: 'Organic performance is stable with one clear CTR opportunity.',
  recommendations: [
    {
      priority: 'MEDIUM',
      area: 'Query CTR',
      finding: 'The query "mock service" has high impressions but a below-average CTR.',
      evidence: ['impressions: 1200', 'ctr: 0.018', 'position: 4.2'],
      recommendation: 'Rewrite the meta description to better match search intent for this query.',
      expectedImpact: 'Modest CTR uplift on a high-impression query.',
      confidence: 0.6,
      requiresApproval: false,
    },
  ],
}

function fakeUsage() {
  return {
    input_tokens: 400,
    output_tokens: 200,
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
  setAnthropicClientForTests({ messages: { parse } } as unknown as Anthropic)
  return parse
}

describe('SEO Agent + "Run SEO analysis" workflow (Phase 2, BRD Section 25/85)', () => {
  let orgId: string
  let clientId: string
  let noConnectionClientId: string
  let superAdminId: string
  let clientUserId: string

  beforeAll(async () => {
    await registerMetricoolTools()
    await registerGA4Tools()
    await registerGSCTools()
    await registerGoogleAdsTools()
    await registerMetaAdsTools()
    await registerAmazonAdsTools()
    // registerMarketingAnalyticsAgent requires every tool in its allowlist to be registered first.
    await registerMarketingAnalyticsAgent()
    await registerSeoAgent()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const client = await createTestClient(orgId, 'SEO Workflow Client')
    clientId = client.id
    const noConnectionClient = await createTestClient(orgId, 'SEO Workflow No Connection Client')
    noConnectionClientId = noConnectionClient.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'GOOGLE_SEARCH_CONSOLE',
      externalAccountId: 'https://example.com/',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(connection.id)
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { agentId: { not: null } } })
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await db.agentTool.deleteMany({ where: { agent: { key: SEO_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: SEO_AGENT_KEY } })
    await cleanupOrg(orgId, [superAdminId, clientUserId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('registers the SEO Agent with exactly one LOW-risk tool: gsc.get_search_performance', async () => {
    const agent = await db.agent.findFirstOrThrow({ where: { key: SEO_AGENT_KEY } })
    const agentTools = await db.agentTool.findMany({ where: { agentId: agent.id }, include: { tool: true } })
    expect(agentTools.map((at) => at.tool.key)).toEqual(['gsc.get_search_performance'])
    expect(agentTools[0]?.tool.riskLevel).toBe('LOW')
  })

  it('gathers both query- and page-level Search Console data and returns structured SEO recommendations', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_SEO_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runSeoAnalysis({
      ctx: ctx!,
      clientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
    })

    expect(result.aiRunId).toBeTruthy()
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]?.area).toBe('Query CTR')
    expect(result.dataGaps).toHaveLength(0)

    const call = parse.mock.calls[0]![0] as { system: string; messages: Array<{ content: string }> }
    expect(call.system).toContain('SEO Agent') // from prompts/seo/v1.md
    expect(call.messages[0]?.content).toContain('top queries')
    expect(call.messages[0]?.content).toContain('top pages')
  })

  it('never calls Claude and returns aiRunId: null when Search Console is not connected (no fabricated analysis)', async () => {
    const parse = mockClaudeParse()
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runSeoAnalysis({
      ctx: ctx!,
      clientId: noConnectionClientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
    })
    expect(result.aiRunId).toBeNull()
    expect(result.dataGaps).toHaveLength(2) // query + page calls both failed
    expect(parse).not.toHaveBeenCalled()
  })

  it('runSeoAnalysisWorkflow persists the recommendation, routes it, and generates a distinctly-titled SEO report', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_SEO_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runSeoAnalysisWorkflow({
      ctx: ctx!,
      clientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
    })

    expect(result.recommendationIds).toHaveLength(1)
    expect(result.taskIds.length + result.approvalIds.length).toBe(1) // MEDIUM/not-requiresApproval -> routed to a task

    const report = await db.report.findUniqueOrThrow({ where: { id: result.reportId } })
    expect(report.title).toContain('SEO Performance Report')
    expect(report.type).toBe('INTERNAL')
  })

  it('a client cannot trigger an SEO analysis themselves (same analysis.trigger gate as "Analyze this client")', async () => {
    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(
      runSeoAnalysisWorkflow({ ctx: clientCtx!, clientId, range: { from: '2026-01-01', to: '2026-01-31' } }),
    ).rejects.toThrow(ForbiddenError)
  })

  describe('listSeoRecommendations / listSeoRecommendationsForOrg', () => {
    it('surfaces only recommendations the SEO Agent produced - not a general-analysis recommendation that happens to have area "SEO" too', async () => {
      // A general-analysis recommendation with area "SEO" (the omnibus agent
      // can legitimately produce these too, per its own prompt) must NOT
      // show up here - this proves the AiRun.contextIds.agentKey filter is
      // actually doing the identifying, not the free-text `area` field.
      const generalParse = mockClaudeParse()
      generalParse.mockResolvedValueOnce({
        parsed_output: {
          summary: 'General analysis output.',
          recommendations: [
            {
              priority: 'LOW',
              area: 'SEO',
              finding: 'From the general Marketing Analytics Agent, not the SEO Agent.',
              evidence: ['n/a'],
              recommendation: 'n/a',
              confidence: 0.3,
              requiresApproval: false,
            },
          ],
        },
        usage: fakeUsage(),
      })
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      await runMarketingAnalysis({
        ctx: ctx!,
        clientId,
        range: { from: '2026-02-01', to: '2026-02-28' },
        socialNetwork: 'instagram',
        adsChannel: 'googleAds',
      })

      const seoParse = mockClaudeParse()
      seoParse.mockResolvedValueOnce({ parsed_output: VALID_SEO_OUTPUT, usage: fakeUsage() })
      await runSeoAnalysisWorkflow({ ctx: ctx!, clientId, range: { from: '2026-02-01', to: '2026-02-28' } })

      const orgList = await listSeoRecommendationsForOrg(ctx!)
      expect(orgList.every((r) => r.area !== 'SEO')).toBe(true) // the general-agent one is excluded
      expect(orgList.some((r) => r.area === 'Query CTR')).toBe(true) // the SEO Agent one is included

      const clientList = await listSeoRecommendations(ctx!, clientId)
      expect(clientList.every((r) => r.area !== 'SEO')).toBe(true)
    })
  })
})
