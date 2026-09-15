import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { MARKETING_SEARCH_AGENT_KEY, answerMarketingQuestion, answerWizardQuestion } from '@/lib/search/marketing-search'
import { createApproval } from '@/lib/approvals/approvals'
import { persistRecommendations } from '@/lib/recommendations/persist'
import { db } from '@/lib/db/client'
import { ForbiddenError } from '@/lib/rbac/errors'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

function fakeUsage() {
  return {
    input_tokens: 200,
    output_tokens: 100,
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

/**
 * `marketing-search.ts` is the first module in the codebase that aggregates
 * cross-client data (approvals + recommendations across every client a
 * caller can see) into a single LLM prompt - exactly the shape of surface
 * docs/SECURITY.md warns is easiest to get wrong. This proves org A's user
 * never gets org B's data folded into their prompt or their answer's links,
 * even when a client in org B shares the same name as one in org A (the
 * case a naive name-based lookup would get wrong).
 */
describe('security: marketing-search never leaks across organizations', () => {
  let orgAId: string
  let orgBId: string
  let clientAId: string
  let clientBId: string
  let userAId: string

  beforeAll(async () => {
    const orgA = await createTestOrg()
    orgAId = orgA.id
    const rolesA = await createSystemRoles(orgAId)
    const clientA = await createTestClient(orgAId, 'Shared Name Client')
    clientAId = clientA.id

    const orgB = await createTestOrg()
    orgBId = orgB.id
    const rolesB = await createSystemRoles(orgBId)
    const clientB = await createTestClient(orgBId, 'Shared Name Client') // same name, different org
    clientBId = clientB.id

    const userA = await createTestUser()
    userAId = userA.id
    await testDb.organizationUser.create({ data: { organizationId: orgAId, userId: userAId, roleId: rolesA.get('super_admin')!.id } })

    const userB = await createTestUser()
    await testDb.organizationUser.create({ data: { organizationId: orgBId, userId: userB.id, roleId: rolesB.get('super_admin')!.id } })

    await createApproval({
      organizationId: orgBId,
      clientId: clientBId,
      requestedBy: userB.id,
      actionType: 'org_b.secret_action',
      riskLevel: 'CRITICAL',
      actionSummary: 'ORG B CONFIDENTIAL: acquire competitor ad account',
    })
    const runB = await db.aiRun.create({ data: { organizationId: orgBId, clientId: clientBId, model: 'test', promptVersion: 'test/v1', status: 'SUCCEEDED' } })
    const ctxB = await resolveAuthContext(testDb, userB.id, orgBId)
    await persistRecommendations(ctxB!, clientBId, runB.id, [
      { priority: 'CRITICAL', area: 'Google Ads', finding: 'ORG B SECRET: internal margin is 340%', evidence: ['margin: 3.4'], recommendation: 'n/a', confidence: 0.9, requiresApproval: true },
    ])
    const campaignB = await db.campaign.create({
      data: { organizationId: orgBId, clientId: clientBId, provider: 'META_ADS', providerCampaignId: 'org_b_secret_campaign', name: 'ORG B SECRET Campaign', status: 'ACTIVE', budget: 999 },
    })
    await db.campaignMetric.create({
      data: { campaignId: campaignB.id, organizationId: orgBId, clientId: clientBId, date: new Date(), source: 'META_ADS', retrievedAt: new Date(), period: 'daily', spend: 77777 },
    })
  })

  afterAll(async () => {
    await db.notification.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    await db.recommendation.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    await db.approval.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    await db.campaignMetric.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    await db.campaign.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    await db.aiRun.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    await db.agentTool.deleteMany({ where: { agent: { key: MARKETING_SEARCH_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: MARKETING_SEARCH_AGENT_KEY } })
    await cleanupOrg(orgAId, [userAId])
    await cleanupOrg(orgBId, [])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('answerMarketingQuestion never includes org B approvals/recommendations in org A\'s prompt, even asking about "Shared Name Client"', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({
      parsed_output: { answer: 'Nothing urgent for this client.', notCovered: false, workingWell: [], needsAttention: [], nextSteps: [] },
      usage: fakeUsage(),
    })

    const ctxA = await resolveAuthContext(testDb, userAId, orgAId)
    const result = await answerMarketingQuestion(ctxA!, 'How is Shared Name Client doing?')

    const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
    const prompt = call.messages[0]!.content
    expect(prompt).not.toContain('ORG B')
    expect(prompt).not.toContain('acquire competitor ad account')
    expect(prompt).not.toContain('internal margin is 340%')
    expect(prompt).not.toContain('77777')

    // The matched client must resolve to org A's own client, not org B's same-named one.
    expect(result.links.find((l) => l.label === 'Shared Name Client')?.href).toBe(`/dashboard/clients/${clientAId}`)
  })

  it('answerWizardQuestion refuses to build context for a client belonging to another org', async () => {
    const parse = mockClaudeParse()
    const ctxA = await resolveAuthContext(testDb, userAId, orgAId)

    await expect(
      answerWizardQuestion({ ctx: ctxA!, clientId: clientBId, step: 'Where to run it', question: 'Which platform should I pick?' }),
    ).rejects.toThrow(ForbiddenError)
    expect(parse).not.toHaveBeenCalled()
  })
})
