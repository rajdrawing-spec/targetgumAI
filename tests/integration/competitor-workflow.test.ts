import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { addClientCompetitor } from '@/lib/clients/brain'
import { COMPETITOR_AGENT_KEY, registerCompetitorAgent, runCompetitorAnalysis } from '@/lib/agents/competitor-agent'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { runCompetitorAnalysisWorkflow } from '@/lib/workflows/competitor-analysis-workflow'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Competitor Agent + "Run competitor analysis" workflow (BRD Section 25's
 * "Later: Competitor Agent", built now as a Phase 2 item - Section 85).
 * docs/DECISIONS.md has the full design rationale, including why this
 * agent has an empty tool allowlist (competitor data is stored, never
 * fetched from a provider).
 */

const VALID_COMPETITOR_OUTPUT = {
  summary: 'One competitor emphasizes enterprise positioning where the client is mid-market - a clear differentiation opportunity.',
  recommendations: [
    {
      priority: 'MEDIUM',
      area: 'Positioning gap',
      finding: 'Competitor X\'s stated positioning is "premium, enterprise-focused"; the client\'s own business context targets small/mid-market.',
      evidence: ['Competitor X positioning: premium, enterprise-focused', 'Client business context: mid-market focus'],
      recommendation: 'Lean into mid-market messaging (speed, price, simplicity) rather than competing on enterprise features.',
      confidence: 0.6,
      requiresApproval: false,
    },
  ],
}

function fakeUsage() {
  return {
    input_tokens: 300,
    output_tokens: 150,
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

describe('Competitor Agent + "Run competitor analysis" workflow (Phase 2, BRD Section 25/85)', () => {
  let orgId: string
  let clientId: string
  let noCompetitorsClientId: string
  let superAdminId: string
  let clientUserId: string

  beforeAll(async () => {
    await registerCompetitorAgent()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const client = await createTestClient(orgId, 'Competitor Workflow Client')
    clientId = client.id
    const noCompetitorsClient = await createTestClient(orgId, 'Competitor Workflow No Competitors Client')
    noCompetitorsClientId = noCompetitorsClient.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await addClientCompetitor(ctx!, clientId, {
      name: 'Competitor X',
      url: 'https://competitor-x.test',
      positioning: 'premium, enterprise-focused',
      observations: 'Recently launched a new pricing tier.',
    })
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { agentId: { not: null } } })
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await db.agentTool.deleteMany({ where: { agent: { key: COMPETITOR_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: COMPETITOR_AGENT_KEY } })
    await cleanupOrg(orgId, [superAdminId, clientUserId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('registers the Competitor Agent with an empty tool allowlist - no provider to fetch from', async () => {
    const agent = await db.agent.findFirstOrThrow({ where: { key: COMPETITOR_AGENT_KEY } })
    const agentTools = await db.agentTool.findMany({ where: { agentId: agent.id } })
    expect(agentTools).toHaveLength(0)
  })

  it('runCompetitorAnalysis includes the stored competitor record in the prompt and returns structured recommendations', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_COMPETITOR_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runCompetitorAnalysis({ ctx: ctx!, clientId })

    expect(result.aiRunId).toBeTruthy()
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]?.area).toBe('Positioning gap')
    expect(result.metrics).toEqual([]) // qualitative only, nothing to snapshot

    const call = parse.mock.calls[0]![0] as { system: string; messages: Array<{ content: string }> }
    expect(call.system).toContain('Competitor Agent') // from prompts/competitor/v1.md
    expect(call.messages[0]?.content).toContain('Competitor X')
    expect(call.messages[0]?.content).toContain('premium, enterprise-focused')
  })

  it('never calls Claude and returns aiRunId: null when the client has no competitors on file (no fabrication)', async () => {
    const parse = mockClaudeParse()
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runCompetitorAnalysis({ ctx: ctx!, clientId: noCompetitorsClientId })

    expect(result.aiRunId).toBeNull()
    expect(result.recommendations).toHaveLength(0)
    expect(result.dataGaps).toHaveLength(1)
    expect(parse).not.toHaveBeenCalled()
  })

  it('runCompetitorAnalysisWorkflow persists the recommendation, routes it, and generates a distinctly-titled report', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_COMPETITOR_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runCompetitorAnalysisWorkflow({ ctx: ctx!, clientId })

    expect(result.recommendationIds).toHaveLength(1)
    expect(result.taskIds.length + result.approvalIds.length).toBe(1)

    const report = await db.report.findUniqueOrThrow({ where: { id: result.reportId } })
    expect(report.title).toContain('Competitor Positioning Report')
    expect(report.type).toBe('INTERNAL')
  })

  it('a client cannot trigger a competitor analysis themselves (same analysis.trigger gate as every other analysis)', async () => {
    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(runCompetitorAnalysisWorkflow({ ctx: clientCtx!, clientId })).rejects.toThrow(ForbiddenError)
  })
})
