import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { MARKETING_SEARCH_AGENT_KEY, answerMarketingQuestion, answerWizardQuestion } from '@/lib/search/marketing-search'
import { createApproval } from '@/lib/approvals/approvals'
import { persistRecommendations } from '@/lib/recommendations/persist'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

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
  const fakeClient = { messages: { parse } } as unknown as Anthropic
  setAnthropicClientForTests(fakeClient)
  return parse
}

async function fakeAiRun(orgId: string, clientId: string) {
  const run = await db.aiRun.create({ data: { organizationId: orgId, clientId, model: 'test', promptVersion: 'test/v1', status: 'SUCCEEDED' } })
  return run.id
}

/**
 * The unified read-only search/Q&A agent behind the dashboard "ask anything"
 * bar and the ad campaign wizard's "not sure? ask" helper (BRD Section
 * 19/56: a search result is never itself an action, never fabricates a
 * client/number/status not actually in the data given).
 */
describe('marketing-search (dashboard search bar + wizard help)', () => {
  let orgId: string
  let clientId: string
  let otherClientId: string
  let userId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Marketing Search Test Client')
    clientId = client.id
    const otherClient = await createTestClient(orgId, 'Marketing Search Other Client')
    otherClientId = otherClient.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    await createApproval({
      organizationId: orgId,
      clientId: otherClientId,
      requestedBy: userId,
      actionType: 'other.action',
      riskLevel: 'HIGH',
      actionSummary: 'Something only relevant to the other client',
    })
  })

  afterAll(async () => {
    await db.notification.deleteMany({ where: { organizationId: orgId } })
    await db.approval.deleteMany({ where: { organizationId: orgId } })
    await db.recommendation.deleteMany({ where: { organizationId: orgId } })
    await db.campaignMetric.deleteMany({ where: { organizationId: orgId } })
    await db.campaign.deleteMany({ where: { organizationId: orgId } })
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await db.agentTool.deleteMany({ where: { agent: { key: MARKETING_SEARCH_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: MARKETING_SEARCH_AGENT_KEY } })
    await cleanupOrg(orgId, [userId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  describe('answerMarketingQuestion (dashboard search bar)', () => {
    it('self-registers as a real, empty-allowlist Agent and grounds the answer in real pending approvals + high-priority recommendations', async () => {
      await createApproval({
        organizationId: orgId,
        clientId,
        requestedBy: userId,
        actionType: 'test.action',
        riskLevel: 'HIGH',
        actionSummary: 'Increase Google Ads budget by 20%',
      })
      const aiRunId = await fakeAiRun(orgId, clientId)
      await persistRecommendations(await resolveAuthContext(testDb, userId, orgId).then((c) => c!), clientId, aiRunId, [
        { priority: 'CRITICAL', area: 'Google Ads', finding: 'CPA doubled overnight', evidence: ['cpa: 80'], recommendation: 'Pause worst ad set', confidence: 0.9, requiresApproval: true },
        { priority: 'LOW', area: 'Instagram', finding: 'Minor engagement dip', evidence: ['er: 1.1%'], recommendation: 'Monitor', confidence: 0.4, requiresApproval: false },
      ])

      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({ parsed_output: { answer: 'You have a pending HIGH risk approval and one CRITICAL recommendation.', notCovered: false }, usage: fakeUsage() })

      const ctx = await resolveAuthContext(testDb, userId, orgId)
      const result = await answerMarketingQuestion(ctx!, 'What needs my attention right now?')

      expect(result.answer).toContain('pending HIGH risk approval')
      expect(result.notCovered).toBe(false)
      expect(result.aiRunId).toBeTruthy()
      expect(result.links.some((l) => l.href === '/dashboard/approvals')).toBe(true)
      expect(result.links.some((l) => l.href === '/dashboard/recommendations')).toBe(true)

      const agent = await db.agent.findFirstOrThrow({ where: { key: MARKETING_SEARCH_AGENT_KEY } })
      const agentTools = await db.agentTool.findMany({ where: { agentId: agent.id } })
      expect(agentTools).toHaveLength(0) // never executes anything itself

      const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
      expect(call.messages[0]?.content).toContain('Increase Google Ads budget by 20%')
      expect(call.messages[0]?.content).toContain('CPA doubled overnight')
      expect(call.messages[0]?.content).not.toContain('Minor engagement dip') // LOW priority, filtered out

      await db.notification.deleteMany({ where: { organizationId: orgId } })
      await db.approval.deleteMany({ where: { clientId } })
      await db.recommendation.deleteMany({ where: { clientId } })
    })

    it('includes a matching client\'s full context when the question names them, and a link to that client', async () => {
      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({ parsed_output: { answer: 'Here is what I know about that client.', notCovered: false }, usage: fakeUsage() })

      const ctx = await resolveAuthContext(testDb, userId, orgId)
      const result = await answerMarketingQuestion(ctx!, 'How is Marketing Search Test Client doing?')

      expect(result.links.some((l) => l.href === `/dashboard/clients/${clientId}`)).toBe(true)
      const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
      expect(call.messages[0]?.content).toContain('Full context for Marketing Search Test Client')
    })

    it('grounds the answer in the matched client\'s real synced Meta Ads campaign performance, never a fabricated "no data" answer', async () => {
      const campaign = await db.campaign.create({
        data: { organizationId: orgId, clientId, provider: 'META_ADS', providerCampaignId: 'mock_meta_1', name: 'LHO | Sales campaign | Retargeting', status: 'ACTIVE', budget: 600 },
      })
      await db.campaignMetric.create({
        data: {
          campaignId: campaign.id,
          organizationId: orgId,
          clientId,
          date: new Date(),
          source: 'META_ADS',
          retrievedAt: new Date(),
          period: 'daily',
          spend: 3030.99,
          impressions: 6560,
          clicks: 170,
          conversions: 12,
          revenue: 0,
        },
      })

      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({ parsed_output: { answer: 'Retargeting has spent $3030.99 across 6560 impressions and 170 clicks, with 0x ROAS so far.', notCovered: false }, usage: fakeUsage() })

      const ctx = await resolveAuthContext(testDb, userId, orgId)
      const result = await answerMarketingQuestion(ctx!, 'Meta ads of Marketing Search Test Client, how are they performing?')

      expect(result.notCovered).toBe(false)
      expect(result.links.some((l) => l.href === `/dashboard/ads?clientId=${clientId}`)).toBe(true)

      const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
      expect(call.messages[0]?.content).toContain('LHO | Sales campaign | Retargeting')
      expect(call.messages[0]?.content).toContain('3030.99')
      expect(call.messages[0]?.content).toContain('170')

      await db.campaignMetric.deleteMany({ where: { clientId } })
      await db.campaign.deleteMany({ where: { clientId } })
    })

    it('rolls up campaign spend per client when the question names no specific client', async () => {
      const campaign = await db.campaign.create({
        data: { organizationId: orgId, clientId, provider: 'META_ADS', providerCampaignId: 'mock_meta_2', name: 'Rollup Test Campaign', status: 'ACTIVE', budget: 100 },
      })
      await db.campaignMetric.create({
        data: { campaignId: campaign.id, organizationId: orgId, clientId, date: new Date(), source: 'META_ADS', retrievedAt: new Date(), period: 'daily', spend: 500, revenue: 1000 },
      })

      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({ parsed_output: { answer: 'Marketing Search Test Client has spent the most.', notCovered: false }, usage: fakeUsage() })

      const ctx = await resolveAuthContext(testDb, userId, orgId)
      await answerMarketingQuestion(ctx!, 'How is our overall ad spend looking?')

      const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
      expect(call.messages[0]?.content).toContain('rolled up per client')
      expect(call.messages[0]?.content).toContain('Marketing Search Test Client: 1 campaign, $500.00 spent, 2.00x blended ROAS')

      await db.campaignMetric.deleteMany({ where: { clientId } })
      await db.campaign.deleteMany({ where: { clientId } })
    })

    it('rejects an empty query without calling the model', async () => {
      const parse = mockClaudeParse()
      const ctx = await resolveAuthContext(testDb, userId, orgId)
      await expect(answerMarketingQuestion(ctx!, '   ')).rejects.toThrow()
      expect(parse).not.toHaveBeenCalled()
    })
  })

  describe('answerWizardQuestion (ad campaign wizard "not sure? ask" helper)', () => {
    it('grounds the answer in the named client\'s context and where they are in the wizard, never the wider org snapshot', async () => {
      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({ parsed_output: { answer: 'Daily budget is the most you will spend per day - the platform will not exceed it.' }, usage: fakeUsage() })

      const ctx = await resolveAuthContext(testDb, userId, orgId)
      const result = await answerWizardQuestion({
        ctx: ctx!,
        clientId,
        step: 'Budget & audience',
        formSoFar: 'Goal: Get more sales; Daily budget: $20',
        question: 'What does daily budget mean?',
      })

      expect(result.answer).toContain('most you will spend')
      expect(result.aiRunId).toBeTruthy()

      const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
      expect(call.messages[0]?.content).toContain('Budget & audience')
      expect(call.messages[0]?.content).toContain('Daily budget: $20')
      expect(call.messages[0]?.content).toContain('What does daily budget mean?')
      expect(call.messages[0]?.content).not.toContain('Other Client')
    })

    it('rejects an empty question without calling the model', async () => {
      const parse = mockClaudeParse()
      const ctx = await resolveAuthContext(testDb, userId, orgId)
      await expect(answerWizardQuestion({ ctx: ctx!, clientId, step: 'Step 1', question: '  ' })).rejects.toThrow()
      expect(parse).not.toHaveBeenCalled()
    })
  })
})
