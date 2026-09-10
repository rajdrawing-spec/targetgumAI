import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { MARKETING_ANALYTICS_AGENT_KEY, registerMarketingAnalyticsAgent } from '@/lib/agents/analytics-agent'
import { db } from '@/lib/db/client'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { registerGA4Tools } from '@/lib/integrations/ga4/tools'
import { registerGSCTools } from '@/lib/integrations/gsc/tools'
import { registerMetricoolTools } from '@/lib/integrations/metricool/tools'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ANALYZE_CLIENT_WORKFLOW_KEY, runAnalyzeClientWorkflow } from '@/lib/workflows/analyze-client-workflow'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/** One HIGH (-> approval) and one MEDIUM (-> task) recommendation, so a single run exercises both routing branches. */
const MIXED_PRIORITY_OUTPUT = {
  summary: 'One campaign is underperforming on CPA; social posting cadence could improve.',
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
    {
      priority: 'MEDIUM',
      area: 'Instagram',
      finding: 'Posting cadence has dropped over the last two weeks.',
      evidence: ['posts_last_14d: 3'],
      likelyCause: 'No scheduled content in the calendar.',
      recommendation: 'Resume a 3x/week posting cadence.',
      expectedImpact: 'Restore engagement trend.',
      confidence: 0.6,
      requiresApproval: false,
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

describe('"Analyze Client A" workflow (Day 11, BRD Section 46) - the full pipeline wired into one callable, tracked, audited flow', () => {
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
    const client = await createTestClient(orgId, 'Analyze Workflow Client')
    clientId = client.id
    const noConnectionsClient = await createTestClient(orgId, 'Analyze Workflow No Connections Client')
    noConnectionsClientId = noConnectionsClient.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    for (const [provider, externalId] of [
      ['METRICOOL', 'mock-brand-workflow'],
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

  it('success path: runs analysis, persists + routes recommendations to both a task and an approval, generates a report, records a SUCCEEDED run with every step, and audits it', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: MIXED_PRIORITY_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await runAnalyzeClientWorkflow({
      ctx: ctx!,
      clientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
      socialNetwork: 'instagram',
      adsChannel: 'googleAds',
    })

    expect(result.analysis.aiRunId).toBeTruthy()
    expect(result.recommendationIds).toHaveLength(2)
    expect(result.taskIds).toHaveLength(1)
    expect(result.approvalIds).toHaveLength(1)
    expect(result.reportId).toBeTruthy()

    const run = await db.workflowRun.findUniqueOrThrow({ where: { id: result.workflowRunId } })
    expect(run.status).toBe('SUCCEEDED')
    expect(run.clientId).toBe(clientId)

    const steps = await db.workflowStep.findMany({ where: { workflowRunId: run.id }, orderBy: { startedAt: 'asc' } })
    const stepsByKey = new Map(steps.map((s) => [s.stepKey, s]))
    expect(stepsByKey.get('analysis')?.status).toBe('SUCCEEDED')
    expect(stepsByKey.get('persist_recommendations')?.status).toBe('SUCCEEDED')
    expect(stepsByKey.get('route_recommendations')?.status).toBe('SUCCEEDED')
    expect(stepsByKey.get('report')?.status).toBe('SUCCEEDED')

    const recommendations = await db.recommendation.findMany({ where: { id: { in: result.recommendationIds } } })
    expect(recommendations).toHaveLength(2)
    const highRec = recommendations.find((r) => r.priority === 'HIGH')
    const mediumRec = recommendations.find((r) => r.priority === 'MEDIUM')
    expect(highRec?.approvalId).toBe(result.approvalIds[0])

    const task = await db.task.findUniqueOrThrow({ where: { id: result.taskIds[0]! } })
    expect(task.clientId).toBe(clientId)
    expect(mediumRec).toBeTruthy()

    const approval = await db.approval.findUniqueOrThrow({ where: { id: result.approvalIds[0]! } })
    expect(approval.status).toBe('PENDING')
    expect(approval.riskLevel).toBe('HIGH')

    const report = await db.report.findUniqueOrThrow({ where: { id: result.reportId } })
    expect(report.type).toBe('INTERNAL')
    expect(report.clientId).toBe(clientId)

    const auditEvents = await db.auditEvent.findMany({
      where: { organizationId: orgId, clientId, action: `workflow.${ANALYZE_CLIENT_WORKFLOW_KEY}` },
    })
    expect(auditEvents.some((e) => e.result === 'SUCCESS')).toBe(true)

    await db.recommendation.deleteMany({ where: { id: { in: result.recommendationIds } } })
    await db.task.deleteMany({ where: { id: { in: result.taskIds } } })
    await db.approval.deleteMany({ where: { id: { in: result.approvalIds } } })
  })

  it('all-data-gaps path: when no integration is connected, persist/route steps are SKIPPED but a report still generates and the workflow still SUCCEEDS (BRD Section 19 - never fabricate)', async () => {
    const parse = mockClaudeParse()

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await runAnalyzeClientWorkflow({
      ctx: ctx!,
      clientId: noConnectionsClientId,
      range: { from: '2026-01-01', to: '2026-01-31' },
      socialNetwork: 'instagram',
      adsChannel: 'googleAds',
    })

    expect(result.analysis.aiRunId).toBeNull()
    expect(result.recommendationIds).toHaveLength(0)
    expect(result.taskIds).toHaveLength(0)
    expect(result.approvalIds).toHaveLength(0)
    expect(parse).not.toHaveBeenCalled()

    const run = await db.workflowRun.findUniqueOrThrow({ where: { id: result.workflowRunId } })
    expect(run.status).toBe('SUCCEEDED')

    const steps = await db.workflowStep.findMany({ where: { workflowRunId: run.id } })
    const stepsByKey = new Map(steps.map((s) => [s.stepKey, s]))
    expect(stepsByKey.get('analysis')?.status).toBe('SUCCEEDED')
    expect(stepsByKey.get('persist_recommendations')?.status).toBe('SKIPPED')
    expect(stepsByKey.get('route_recommendations')?.status).toBe('SKIPPED')
    expect(stepsByKey.get('report')?.status).toBe('SUCCEEDED')

    const report = await db.report.findUniqueOrThrow({ where: { id: result.reportId } })
    expect(report.clientId).toBe(noConnectionsClientId)
  })

  it('failure path: when the analysis step throws, the run is marked FAILED, an audit FAILURE event is recorded, and the error propagates', async () => {
    const parse = mockClaudeParse()
    parse.mockRejectedValueOnce(new Error('Simulated Claude API outage.'))

    const ctx = await resolveAuthContext(testDb, userId, orgId)

    await expect(
      runAnalyzeClientWorkflow({
        ctx: ctx!,
        clientId,
        range: { from: '2026-02-01', to: '2026-02-28' },
        socialNetwork: 'instagram',
        adsChannel: 'googleAds',
      }),
    ).rejects.toThrow()

    const runs = await db.workflowRun.findMany({
      where: { organizationId: orgId, clientId, status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
    })
    expect(runs.length).toBeGreaterThanOrEqual(1)
    expect(runs[0]?.error).toContain('Simulated Claude API outage.')

    const steps = await db.workflowStep.findMany({ where: { workflowRunId: runs[0]!.id } })
    expect(steps.some((s) => s.stepKey === 'analysis' && s.status === 'RUNNING')).toBe(true)
    // No later step (persist_recommendations/route_recommendations/report) ran once analysis threw.
    expect(steps.some((s) => s.stepKey === 'report')).toBe(false)

    const auditEvents = await db.auditEvent.findMany({
      where: { organizationId: orgId, clientId, action: `workflow.${ANALYZE_CLIENT_WORKFLOW_KEY}`, result: 'FAILURE' },
    })
    expect(auditEvents.length).toBeGreaterThanOrEqual(1)
  })
})
