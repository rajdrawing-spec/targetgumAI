import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { CAMPAIGN_BRIEF_AGENT_KEY, generateCampaignBrief } from '@/lib/ads/campaign-brief'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

const VALID_BRIEF = {
  campaignName: 'Austin Birthday Cakes - Sales',
  strategyNote: 'We will run ads to people nearby likely to be planning a celebration, highlighting same-day delivery.',
  audienceSummary: 'People in the Austin area searching for or interested in custom birthday cakes.',
  budgetAssessment: 'This is a reasonable starting budget - expect a gradual ramp-up as the platform learns.',
  adConcept: {
    headline: 'Same-Day Birthday Cakes, Delivered',
    primaryText: 'Order a custom birthday cake and get it delivered the same day. Austin-made, always fresh.',
    visualDirection: 'A bright photo of a decorated birthday cake with a delivery box beside it.',
  },
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
  const fakeClient = { messages: { parse } } as unknown as Anthropic
  setAnthropicClientForTests(fakeClient)
  return parse
}

/**
 * The guided campaign wizard's AI step (BRD Section 19: still just a
 * proposal - `generateCampaignBrief` never executes anything, has an
 * empty tool allowlist, same as the Competitor/Creative agents).
 */
describe('generateCampaignBrief (guided ad campaign wizard)', () => {
  let orgId: string
  let clientId: string
  let userId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Campaign Brief Test Client')
    clientId = client.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await db.agentTool.deleteMany({ where: { agent: { key: CAMPAIGN_BRIEF_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: CAMPAIGN_BRIEF_AGENT_KEY } })
    await cleanupOrg(orgId, [userId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('self-registers as a real, empty-allowlist Agent and returns a structured brief', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_BRIEF, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await generateCampaignBrief({
      ctx: ctx!,
      clientId,
      about: "We're a local bakery and want more people to order custom birthday cakes online.",
      goal: 'Get more sales',
      platformChoice: 'GOOGLE_ADS',
      connectedProviders: ['GOOGLE_ADS'],
      dailyBudget: 25,
    })

    expect(result.brief.campaignName).toBe(VALID_BRIEF.campaignName)
    expect(result.brief.adConcept.headline).toBe(VALID_BRIEF.adConcept.headline)
    expect(result.aiRunId).toBeTruthy()

    const aiRun = await db.aiRun.findUniqueOrThrow({ where: { id: result.aiRunId } })
    expect(aiRun.status).toBe('SUCCEEDED')
    expect(aiRun.clientId).toBe(clientId)

    const agent = await db.agent.findFirstOrThrow({ where: { key: CAMPAIGN_BRIEF_AGENT_KEY } })
    const agentTools = await db.agentTool.findMany({ where: { agentId: agent.id } })
    expect(agentTools).toHaveLength(0) // never executes anything itself

    // The prompt actually carries the wizard's plain-language answers.
    const call = parse.mock.calls[0]![0] as { system: string; messages: Array<{ content: string }> }
    expect(call.system).toContain('plain-language wizard')
    expect(call.messages[0]?.content).toContain('Get more sales')
    expect(call.messages[0]?.content).toContain('$25')
    expect(call.messages[0]?.content).toContain('already chosen')
  })

  it('tells the model the platform is undecided when platformChoice is AI_RECOMMEND, constrained to the connected providers', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({
      parsed_output: { ...VALID_BRIEF, recommendedProvider: 'META_ADS' },
      usage: fakeUsage(),
    })

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await generateCampaignBrief({
      ctx: ctx!,
      clientId,
      about: 'A local coffee shop wanting more foot traffic.',
      goal: 'Build awareness',
      platformChoice: 'AI_RECOMMEND',
      connectedProviders: ['META_ADS', 'GOOGLE_ADS'],
      dailyBudget: 15,
    })

    expect(result.brief.recommendedProvider).toBe('META_ADS')
    const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
    expect(call.messages[0]?.content).toContain('not decided yet')
    expect(call.messages[0]?.content).toContain('META_ADS, GOOGLE_ADS')
  })

  it('never invents an audience when none was given - tells the model to say so instead', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_BRIEF, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    await generateCampaignBrief({
      ctx: ctx!,
      clientId,
      about: 'A plumbing company.',
      goal: 'Get more leads or calls',
      platformChoice: 'GOOGLE_ADS',
      connectedProviders: ['GOOGLE_ADS'],
      dailyBudget: 30,
      // audience deliberately omitted
    })

    const call = parse.mock.calls[0]![0] as { messages: Array<{ content: string }> }
    expect(call.messages[0]?.content).toContain('not specified')
  })
})
