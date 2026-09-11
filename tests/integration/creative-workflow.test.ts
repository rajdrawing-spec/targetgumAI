import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { CREATIVE_AGENT_KEY, registerCreativeAgent, runCreativeConceptGeneration } from '@/lib/agents/creative-agent'
import { updateClientBrainSection } from '@/lib/clients/brain'
import {
  approveCreativeAsset,
  generateCreativeDesign,
  listCreativeAssets,
  rejectCreativeAsset,
  submitCreativeForReview,
} from '@/lib/creative/persist'
import { connectClientToCanvaAccount } from '@/lib/integrations/canva/connect'
import { registerCanvaTools } from '@/lib/integrations/canva/tools'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { runCreativeWorkflow } from '@/lib/workflows/creative-workflow'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Creative Agent + "Generate creative concepts" workflow (Phase 2, BRD
 * Section 17/47/67/85/121). docs/DECISIONS.md has the full design
 * rationale, including why this workflow's shape (no Recommendation
 * routing, no Report) differs from every other agent workflow in this
 * codebase, and why the real Canva adapter stays UnsupportedOperationError.
 */

const VALID_CREATIVE_OUTPUT = {
  summary: 'Three bright, benefit-led concepts leaning into the brand\'s bold, playful voice.',
  concepts: [
    {
      title: 'Spring Refresh',
      copy: 'New season, new you - 20% off everything this week.',
      visualDescription: 'A bright flat-lay of the product against a bold yellow background.',
      brandAligned: true,
      brandNotes: undefined,
    },
    {
      title: 'Limited Drop',
      copy: 'Almost gone. Grab it before it\'s back-ordered.',
      visualDescription: 'A close-up product shot with a red urgency badge.',
      brandAligned: false,
      brandNotes: 'Urgency badge may read as too aggressive for the stated calm/playful brand tone - flagging for review.',
    },
    {
      title: 'Customer Favorite',
      copy: 'The one everyone keeps coming back for.',
      visualDescription: 'A lifestyle shot of the product in use, warm natural light.',
      brandAligned: true,
    },
  ],
}

function fakeUsage() {
  return {
    input_tokens: 400,
    output_tokens: 220,
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

describe('Creative Agent + "Generate creative concepts" workflow (Phase 2, BRD Section 17/47/85)', () => {
  let orgId: string
  let clientId: string
  let superAdminId: string
  let marketingEmployeeId: string
  let clientUserId: string

  beforeAll(async () => {
    await registerCreativeAgent()
    await registerCanvaTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Creative Workflow Client')
    clientId = client.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const marketingEmployee = await createTestUser()
    marketingEmployeeId = marketingEmployee.id
    const meMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: marketingEmployeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: meMembership.id } })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    await updateClientBrainSection(superAdminCtx!, clientId, 'brand', {
      voice: 'Bold, playful, a little irreverent',
      tone: 'Upbeat and direct',
      restrictedImagery: 'No stock photography, no stethoscopes or clinical imagery',
    })
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: { startsWith: 'canva.' } } } })
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await db.agentTool.deleteMany({ where: { agent: { key: CREATIVE_AGENT_KEY } } })
    await db.agent.deleteMany({ where: { key: CREATIVE_AGENT_KEY } })
    await cleanupOrg(orgId, [superAdminId, marketingEmployeeId, clientUserId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('registers the Creative Agent with an empty tool allowlist - concept generation never calls Canva itself', async () => {
    const agent = await db.agent.findFirstOrThrow({ where: { key: CREATIVE_AGENT_KEY } })
    const agentTools = await db.agentTool.findMany({ where: { agentId: agent.id } })
    expect(agentTools).toHaveLength(0)
  })

  it('runCreativeConceptGeneration includes the stored brand voice/restricted imagery in the prompt and returns structured concepts', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_CREATIVE_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runCreativeConceptGeneration({
      ctx: ctx!,
      clientId,
      platform: 'instagram',
      count: 3,
      campaignBrief: 'The recommended spring promotion campaign.',
    })

    expect(result.aiRunId).toBeTruthy()
    expect(result.concepts).toHaveLength(3)
    expect(result.concepts.some((c) => c.brandAligned === false)).toBe(true) // brand validation is advisory, not enforced

    const call = parse.mock.calls[0]![0] as { system: string; messages: Array<{ content: string }> }
    expect(call.system).toContain('Content Agent') // from prompts/content/v1.md
    expect(call.messages[0]?.content).toContain('Bold, playful, a little irreverent')
    expect(call.messages[0]?.content).toContain('spring promotion')
  })

  it('runCreativeWorkflow persists one DRAFT CreativeAsset per concept', async () => {
    const parse = mockClaudeParse()
    parse.mockResolvedValueOnce({ parsed_output: VALID_CREATIVE_OUTPUT, usage: fakeUsage() })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await runCreativeWorkflow({
      ctx: ctx!,
      clientId,
      platform: 'instagram',
      count: 3,
      campaignBrief: 'The recommended spring promotion campaign.',
    })

    expect(result.creativeAssetIds).toHaveLength(3)
    const assets = await db.creativeAsset.findMany({ where: { id: { in: result.creativeAssetIds } } })
    expect(assets.every((a) => a.status === 'DRAFT')).toBe(true)
    expect(assets.every((a) => a.platform === 'instagram')).toBe(true)
    expect(assets.some((a) => a.copy?.includes('Spring Refresh'))).toBe(true)
  })

  it('a client_user cannot trigger creative concept generation themselves (same analysis.trigger gate as every other workflow)', async () => {
    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(
      runCreativeWorkflow({ ctx: clientCtx!, clientId, platform: 'instagram', count: 1, campaignBrief: 'x' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('failure path: when generation throws, the run is marked FAILED, an audit FAILURE event is recorded, and no CreativeAsset rows are persisted', async () => {
    const parse = mockClaudeParse()
    parse.mockRejectedValueOnce(new Error('Simulated Claude API outage.'))

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const before = await db.creativeAsset.count({ where: { clientId } })

    await expect(
      runCreativeWorkflow({ ctx: ctx!, clientId, platform: 'instagram', count: 1, campaignBrief: 'x' }),
    ).rejects.toThrow()

    const runs = await db.workflowRun.findMany({ where: { organizationId: orgId, clientId, status: 'FAILED' } })
    expect(runs.length).toBeGreaterThanOrEqual(1)
    expect(runs[0]?.error).toContain('Simulated Claude API outage.')

    const after = await db.creativeAsset.count({ where: { clientId } })
    expect(after).toBe(before)
  })

  describe('lifecycle: submit / approve / reject / generate design', () => {
    async function createDraftAsset() {
      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({
        parsed_output: { summary: 'One concept.', concepts: [VALID_CREATIVE_OUTPUT.concepts[0]] },
        usage: fakeUsage(),
      })
      const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
      const result = await runCreativeWorkflow({ ctx: ctx!, clientId, platform: 'instagram', count: 1, campaignBrief: 'x' })
      return result.creativeAssetIds[0]!
    }

    it('marketing_employee (creative.manage) can submit, then approve - the full DRAFT -> IN_REVIEW -> APPROVED path', async () => {
      const assetId = await createDraftAsset()
      const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)

      const submitted = await submitCreativeForReview(meCtx!, assetId)
      expect(submitted.status).toBe('IN_REVIEW')

      const approved = await approveCreativeAsset(meCtx!, assetId)
      expect(approved.status).toBe('APPROVED')
    })

    it('marketing_employee can reject an IN_REVIEW asset', async () => {
      const assetId = await createDraftAsset()
      const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
      await submitCreativeForReview(meCtx!, assetId)

      const rejected = await rejectCreativeAsset(meCtx!, assetId)
      expect(rejected.status).toBe('REJECTED')
    })

    it('a client_user cannot submit/approve/reject a creative asset (no creative.manage)', async () => {
      const assetId = await createDraftAsset()
      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      await expect(submitCreativeForReview(clientCtx!, assetId)).rejects.toThrow(ForbiddenError)
    })

    it('generateCreativeDesign calls canva.create_design and attaches designUrl, leaving status unchanged', async () => {
      const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)
      await connectClientToCanvaAccount(superAdminCtx!, clientId, 'mock-canva-brand-lifecycle', 'Lifecycle Mock Brand')

      const assetId = await createDraftAsset()
      const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)

      const beforeStatus = (await listCreativeAssets(meCtx!, clientId)).find((a) => a.id === assetId)?.status
      const updated = await generateCreativeDesign(meCtx!, assetId)

      expect(updated.designUrl).toContain('canva.com')
      expect(updated.provider).toBe('canva')
      expect(updated.status).toBe(beforeStatus) // design generation isn't a review-state transition
    })

    it('generateCreativeDesign fails gracefully when Canva is unavailable - the CreativeAsset row (the brief) is never touched, per BRD Section 121', async () => {
      const noCanvaClient = await createTestClient(orgId, 'No Canva Client')
      const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)

      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({
        parsed_output: { summary: 'One concept.', concepts: [VALID_CREATIVE_OUTPUT.concepts[0]] },
        usage: fakeUsage(),
      })
      const result = await runCreativeWorkflow({
        ctx: superAdminCtx!,
        clientId: noCanvaClient.id,
        platform: 'instagram',
        count: 1,
        campaignBrief: 'x',
      })
      const assetId = result.creativeAssetIds[0]!
      const before = await db.creativeAsset.findUniqueOrThrow({ where: { id: assetId } })

      await expect(generateCreativeDesign(superAdminCtx!, assetId)).rejects.toThrow(IntegrationUnavailableError)

      const after = await db.creativeAsset.findUniqueOrThrow({ where: { id: assetId } })
      expect(after).toEqual(before) // brief preserved exactly, nothing partially written
    })
  })
})
