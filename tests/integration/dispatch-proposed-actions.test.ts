import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerGoogleAdsTools } from '@/lib/integrations/google-ads/tools'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { registerMarketingAnalyticsAgent } from '@/lib/agents/analytics-agent'
import type { ProposedAction } from '@/lib/agents/schemas'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { approveAndExecuteApproval } from '@/lib/tools/execute'
import { dispatchProposedActions } from '@/lib/automation/dispatch-proposed-actions'
import { getOrCreateWorkflow, startWorkflowRun } from '@/lib/workflows/runs'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Phase 3 of the automation roadmap ("agents that propose real actions, not
 * just findings"): `dispatchProposedActions` is the deterministic (never
 * AI-decided, BRD Section 19) orchestrator that turns a Marketing Analytics
 * Agent proposal into an actual outcome. This exercises the full gating
 * matrix directly against the real Tool Registry + Approval Engine + the
 * Google Ads mock provider - never against mocked internals - so a passing
 * suite here means the real `executeTool`/`createApproval` machinery, not a
 * stand-in, produced each outcome.
 */
describe('dispatchProposedActions (Phase 3) - automation level + client policy gating', () => {
  let orgId: string
  let clientId: string
  let userId: string
  // Approval.workflowRunId and ToolExecution.aiRunId are real foreign keys
  // (optional, but FK-checked when set) - one real row of each, reused
  // across every test below, rather than a fake id per call.
  let workflowRunId: string
  let aiRunId: string

  beforeAll(async () => {
    await registerGoogleAdsTools()
    await registerMarketingAnalyticsAgent()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Dispatch Proposed Actions Client')
    clientId = client.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'GOOGLE_ADS',
      externalAccountId: 'mock-gads-dispatch-test',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(connection.id)

    const aiRun = await db.aiRun.create({
      data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'analytics/test', status: 'SUCCEEDED' },
    })
    aiRunId = aiRun.id
    const workflow = await getOrCreateWorkflow(orgId, 'dispatch_proposed_actions_test', 'Dispatch Proposed Actions Test', { steps: [] })
    const workflowRun = await startWorkflowRun({ organizationId: orgId, clientId, workflowId: workflow.id, triggeredBy: userId })
    workflowRunId = workflowRun.id
  })

  afterAll(async () => {
    await db.approval.deleteMany({ where: { clientId } })
    await db.toolExecution.deleteMany({ where: { clientId } })
    await cleanupOrg(orgId, [userId])
  })

  async function setPolicy(data: {
    automationLevel: 'MANUAL' | 'ASSISTED' | 'APPROVAL_BASED' | 'HIGH_AUTOMATION'
    autoChangeAds: boolean
    maxBudgetChangePercent?: number
    maxDailyAdBudget?: number
  }) {
    await db.client.update({ where: { id: clientId }, data: { automationLevel: data.automationLevel } })
    await db.clientPolicy.upsert({
      where: { clientId },
      create: {
        clientId,
        autoChangeAds: data.autoChangeAds,
        maxBudgetChangePercent: data.maxBudgetChangePercent,
        maxDailyAdBudget: data.maxDailyAdBudget,
      },
      update: {
        autoChangeAds: data.autoChangeAds,
        maxBudgetChangePercent: data.maxBudgetChangePercent ?? null,
        maxDailyAdBudget: data.maxDailyAdBudget ?? null,
      },
    })
  }

  function pauseAction(providerCampaignId: string): ProposedAction {
    return {
      provider: 'GOOGLE_ADS',
      action: 'PAUSE_CAMPAIGN',
      providerCampaignId,
      campaignName: 'Mock Search - Brand',
      reasoning: 'CTR down 40% week over week.',
      relatedRecommendationIndex: 0,
    }
  }

  function budgetAction(providerCampaignId: string, newBudget: number): ProposedAction {
    return {
      provider: 'GOOGLE_ADS',
      action: 'UPDATE_BUDGET',
      providerCampaignId,
      newBudget,
      campaignName: 'Mock Performance Max',
      reasoning: 'ROAS is 40% above target.',
      relatedRecommendationIndex: 0,
    }
  }

  const CAMPAIGNS_BY_PROVIDER = {
    GOOGLE_ADS: [
      { providerCampaignId: 'mock-gads-campaign-1', name: 'Mock Search - Brand', channel: 'google_ads', status: 'ENABLED', budget: 40 },
      { providerCampaignId: 'mock-gads-campaign-2', name: 'Mock Performance Max', channel: 'google_ads', status: 'ENABLED', budget: 75 },
    ],
  }

  it('never touches execution when Client.automationLevel is MANUAL, even with autoChangeAds on', async () => {
    await setPolicy({ automationLevel: 'MANUAL', autoChangeAds: true })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [pauseAction('mock-gads-campaign-1')],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('SKIPPED')
    expect((result!.result as { reason: string }).reason).toMatch(/MANUAL/)
  })

  it('never touches execution when ClientPolicy.autoChangeAds is off, even at HIGH_AUTOMATION', async () => {
    await setPolicy({ automationLevel: 'HIGH_AUTOMATION', autoChangeAds: false })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [pauseAction('mock-gads-campaign-1')],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('SKIPPED')
    expect((result!.result as { reason: string }).reason).toMatch(/autoChangeAds/)
  })

  it('refuses a campaign id that was not in the data gathered for this run, regardless of automation level', async () => {
    await setPolicy({ automationLevel: 'HIGH_AUTOMATION', autoChangeAds: true })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [pauseAction('totally-made-up-campaign-id')],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('SKIPPED')
    expect((result!.result as { reason: string }).reason).toMatch(/not found in the data gathered/)
  })

  it('ASSISTED: drafts a pending Approval even for a MEDIUM-risk pause - never auto-executes it', async () => {
    await setPolicy({ automationLevel: 'ASSISTED', autoChangeAds: true })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [pauseAction('mock-gads-campaign-1')],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('PENDING_APPROVAL')
    const approvalId = (result!.result as { approvalId: string }).approvalId
    const approval = await db.approval.findUniqueOrThrow({ where: { id: approvalId } })
    expect(approval.status).toBe('PENDING')
    expect(approval.riskLevel).toBe('MEDIUM')
    expect((approval.proposedChanges as { toolKey: string }).toolKey).toBe('google_ads.pause_campaign')
    expect(approval.actionSummary).toContain('Marketing Analytics Agent')

    const { GoogleAdsMockProvider } = await import('@/lib/integrations/google-ads/mock-provider')

    // Confirm it genuinely never ran against the provider yet - still ENABLED.
    expect(
      (await GoogleAdsMockProvider.getCampaigns('mock-gads-dispatch-test', 'google_ads')).find(
        (c) => c.providerCampaignId === 'mock-gads-campaign-1',
      )?.status,
    ).toBe('ENABLED')

    // And it must be executable once a human clicks Approve - this is the
    // whole point of drafting it, not a hollow gesture. The proposal carries
    // no agentKey (see the dispatcher's doc comment), so this must not hit
    // the Marketing Analytics Agent's read-only tool allowlist at all.
    const executed = await approveAndExecuteApproval(ctx!, approvalId)
    expect(executed.status).toBe('EXECUTED')
    expect(
      (await GoogleAdsMockProvider.getCampaigns('mock-gads-dispatch-test', 'google_ads')).find(
        (c) => c.providerCampaignId === 'mock-gads-campaign-1',
      )?.status,
    ).toBe('PAUSED')
  })

  it('APPROVAL_BASED: a MEDIUM-risk pause executes immediately against the real mock provider', async () => {
    await setPolicy({ automationLevel: 'APPROVAL_BASED', autoChangeAds: true })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [pauseAction('mock-gads-campaign-1')],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('EXECUTED')

    const { GoogleAdsMockProvider } = await import('@/lib/integrations/google-ads/mock-provider')
    const campaigns = await GoogleAdsMockProvider.getCampaigns('mock-gads-dispatch-test', 'google_ads')
    expect(campaigns.find((c) => c.providerCampaignId === 'mock-gads-campaign-1')?.status).toBe('PAUSED')
  })

  it('APPROVAL_BASED: a HIGH-risk budget change within policy still goes to a pending Approval, with no policy-violation note', async () => {
    await setPolicy({ automationLevel: 'APPROVAL_BASED', autoChangeAds: true, maxBudgetChangePercent: 50, maxDailyAdBudget: 1000 })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [budgetAction('mock-gads-campaign-2', 90)], // 75 -> 90 = 20% change, within the 50% cap
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('PENDING_APPROVAL')
    const approval = await db.approval.findUniqueOrThrow({ where: { id: (result!.result as { approvalId: string }).approvalId } })
    expect(approval.riskLevel).toBe('HIGH')
    expect(approval.estimatedImpact).toBeNull()
  })

  it('HIGH_AUTOMATION: a budget change exceeding maxBudgetChangePercent is still only a pending Approval, now flagged with a policy-violation note', async () => {
    await setPolicy({ automationLevel: 'HIGH_AUTOMATION', autoChangeAds: true, maxBudgetChangePercent: 10 })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [budgetAction('mock-gads-campaign-2', 150)], // 75 -> 150 = 100% change, over the 10% cap
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('PENDING_APPROVAL')
    const approval = await db.approval.findUniqueOrThrow({ where: { id: (result!.result as { approvalId: string }).approvalId } })
    expect((approval.estimatedImpact as { policyViolation: string } | null)?.policyViolation).toMatch(/exceeds this client's max of 10%/)
  })

  it('HIGH_AUTOMATION: a budget change exceeding maxDailyAdBudget (summed across all known campaigns) is flagged too', async () => {
    await setPolicy({ automationLevel: 'HIGH_AUTOMATION', autoChangeAds: true, maxDailyAdBudget: 100 })
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    // campaign-1 (40) + proposed campaign-2 change to 90 = 130 projected total, over the 100 cap.
    const [result] = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [budgetAction('mock-gads-campaign-2', 90)],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })

    expect(result!.result.outcome).toBe('PENDING_APPROVAL')
    const approval = await db.approval.findUniqueOrThrow({ where: { id: (result!.result as { approvalId: string }).approvalId } })
    expect((approval.estimatedImpact as { policyViolation: string } | null)?.policyViolation).toMatch(/exceed this client's max of 100/)
  })

  it('returns [] immediately for an empty proposedActions array - no DB writes, no automation-level lookup needed', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const results = await dispatchProposedActions({
      ctx: ctx!,
      clientId,
      workflowRunId,
      aiRunId,
      proposedActions: [],
      campaignsByProvider: CAMPAIGNS_BY_PROVIDER,
    })
    expect(results).toEqual([])
  })
})
