import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { addClientFeedback, updateClientBrainSection } from '@/lib/clients/brain'
import { createClient } from '@/lib/clients/create'
import { db } from '@/lib/db/client'
import { acceptRecommendation, rejectRecommendation } from '@/lib/recommendations/persist'
import { generateReport, getReport, listReports, listReportsForOrg } from '@/lib/reports/generate'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { runAnalyzeClientWorkflow } from '@/lib/workflows/analyze-client-workflow'
import type { AnalysisResult } from '@/lib/agents/analytics-agent'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * The Phase 2 Client Portal permission audit (BRD Section 4.2-4.4, Section
 * 85): fixes real gaps found by re-reading BRD Section 4's per-role
 * capability lists against the actual seeded permission set -
 * `docs/DECISIONS.md` has the full account. Covers all four:
 * `clients.edit` (narrower than `clients.manage`), `recommendations.review`,
 * `feedback.create`, `analysis.trigger`.
 */

const SAMPLE_ANALYSIS: AnalysisResult = {
  summary: 'Steady performance overall.',
  recommendations: [
    {
      priority: 'LOW',
      area: 'Instagram',
      finding: 'Minor dip in saves.',
      evidence: ['saves: 12 (was 15)'],
      recommendation: 'No action needed, monitor next period.',
      confidence: 0.4,
      requiresApproval: false,
    },
  ],
  aiRunId: 'fake-ai-run-id',
  dataGaps: ['GA4 report: connection not configured'],
  metrics: [],
}

function fakeUsage() {
  return {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    cache_creation: null,
    inference_geo: null,
    server_tool_use: null,
    service_tier: null,
  }
}

describe('Client Portal permission audit (Phase 2, BRD Section 4.2-4.4)', () => {
  let orgId: string
  let clientId: string
  let otherClientId: string
  let superAdminId: string
  let accountManagerId: string
  let clientUserId: string
  let otherClientUserId: string // linked to otherClientId only

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const client = await createTestClient(orgId, 'Portal Test Client')
    clientId = client.id
    const otherClient = await createTestClient(orgId, 'Portal Test Other Client')
    otherClientId = otherClient.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const accountManager = await createTestUser()
    accountManagerId = accountManager.id
    const amMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: accountManagerId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: amMembership.id } })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const otherClientUser = await createTestUser()
    otherClientUserId = otherClientUser.id
    await testDb.clientUser.create({ data: { clientId: otherClientId, userId: otherClientUserId } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, accountManagerId, clientUserId, otherClientUserId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  describe('clients.edit vs clients.manage', () => {
    it('an employee can edit their assigned client\'s Brain (clients.edit), but still cannot create a brand-new client (clients.manage stays Super-Admin-only)', async () => {
      const ctx = await resolveAuthContext(testDb, accountManagerId, orgId)
      const brain = await updateClientBrainSection(ctx!, clientId, 'business', { companyName: 'Edited by AM' })
      expect(brain.business).toMatchObject({ companyName: 'Edited by AM' })

      await expect(createClient(ctx!, { name: 'AM Should Not Create This' })).rejects.toThrow(ForbiddenError)
    })

    it('an employee still cannot edit a client outside their assignment', async () => {
      const ctx = await resolveAuthContext(testDb, accountManagerId, orgId)
      await expect(
        updateClientBrainSection(ctx!, otherClientId, 'business', { companyName: 'Should not save' }),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('recommendations.review', () => {
    it('a client-portal user can now accept/reject a recommendation for their own client', async () => {
      const aiRun = await db.aiRun.create({
        data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'v1', status: 'SUCCEEDED' },
      })
      const rec = await db.recommendation.create({
        data: {
          organizationId: orgId, clientId, aiRunId: aiRun.id, priority: 'LOW', area: 'Instagram',
          finding: 'Test finding.', recommendation: 'Test recommendation.', status: 'RECOMMENDED',
        },
      })

      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      const accepted = await acceptRecommendation(clientCtx!, rec.id)
      expect(accepted.status).toBe('ACCEPTED')
    })

    it('rejectRecommendation records the feedback source as CLIENT, not ACCOUNT_MANAGER, when a client-portal user rejects it', async () => {
      const aiRun = await db.aiRun.create({
        data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'v1', status: 'SUCCEEDED' },
      })
      const rec = await db.recommendation.create({
        data: {
          organizationId: orgId, clientId, aiRunId: aiRun.id, priority: 'LOW', area: 'Instagram',
          finding: 'Another test finding.', recommendation: 'Another test recommendation.', status: 'RECOMMENDED',
        },
      })

      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      await rejectRecommendation(clientCtx!, rec.id, 'Not relevant to us.')

      const feedback = await db.clientFeedback.findFirst({
        where: { clientId, content: { contains: 'Not relevant to us.' } },
      })
      expect(feedback?.source).toBe('CLIENT')
    })

    it('a client-portal user still cannot review a recommendation belonging to a different client', async () => {
      const aiRun = await db.aiRun.create({
        data: { organizationId: orgId, clientId: otherClientId, model: 'test-model', promptVersion: 'v1', status: 'SUCCEEDED' },
      })
      const rec = await db.recommendation.create({
        data: {
          organizationId: orgId, clientId: otherClientId, aiRunId: aiRun.id, priority: 'LOW', area: 'Instagram',
          finding: 'Belongs to the other client.', recommendation: 'n/a', status: 'RECOMMENDED',
        },
      })

      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId) // linked to clientId, not otherClientId
      await expect(acceptRecommendation(clientCtx!, rec.id)).rejects.toThrow(ForbiddenError)
    })
  })

  describe('feedback.create', () => {
    it('a client can submit feedback for their own client', async () => {
      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      const feedback = await addClientFeedback(clientCtx!, clientId, {
        category: 'GENERAL_NOTE',
        content: 'Loving the new campaign direction.',
        source: 'CLIENT',
      })
      expect(feedback.content).toContain('Loving the new campaign direction.')
    })

    // The 2026-09-13 role-model simplification (docs/DECISIONS.md) merged
    // account_manager + marketing_employee into one `employee` role with the
    // union of their permissions - every employee now holds
    // `feedback.create` (it was already granted to the former
    // account_manager), so there is no longer a staff role that lacks it to
    // assert against here.
    it('an employee assigned to the client can submit feedback for it', async () => {
      const ctx = await resolveAuthContext(testDb, accountManagerId, orgId)
      const feedback = await addClientFeedback(ctx!, clientId, {
        category: 'GENERAL_NOTE',
        content: 'Employee-submitted note.',
        source: 'ACCOUNT_MANAGER',
      })
      expect(feedback.content).toContain('Employee-submitted note.')
    })
  })

  describe('analysis.trigger', () => {
    it('a client-portal user cannot trigger the "Analyze this client" workflow themselves', async () => {
      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      await expect(
        runAnalyzeClientWorkflow({
          ctx: clientCtx!,
          clientId,
          range: { from: '2026-01-01', to: '2026-01-31' },
          socialNetwork: 'instagram',
          adsChannel: 'googleAds',
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it('an employee (who has analysis.trigger) can still trigger it for their assigned client', async () => {
      const parse = vi.fn()
      parse.mockResolvedValueOnce({ parsed_output: SAMPLE_ANALYSIS, usage: fakeUsage() })
      setAnthropicClientForTests({ messages: { parse } } as unknown as Anthropic)

      const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
      // No integrations connected for this client -> all-data-gaps path, no real Claude call needed to prove authorization passed.
      const result = await runAnalyzeClientWorkflow({
        ctx: amCtx!,
        clientId,
        range: { from: '2026-01-01', to: '2026-01-31' },
        socialNetwork: 'instagram',
        adsChannel: 'googleAds',
      })
      expect(result.workflowRunId).toBeTruthy()
    })
  })

  describe('CLIENT vs INTERNAL report visibility for a client-portal user', () => {
    it('getReport denies a client-portal user an INTERNAL report for their own client, even by direct id', async () => {
      const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
      const internal = await generateReport(
        superCtx!, clientId, SAMPLE_ANALYSIS, { from: '2026-01-01', to: '2026-01-31' }, 'INTERNAL',
      )

      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      await expect(getReport(clientCtx!, internal.id)).rejects.toThrow(ForbiddenError)

      const clientReport = await generateReport(
        superCtx!, clientId, SAMPLE_ANALYSIS, { from: '2026-01-01', to: '2026-01-31' }, 'CLIENT',
      )
      const fetched = await getReport(clientCtx!, clientReport.id)
      expect(fetched.id).toBe(clientReport.id)
    })

    it('listReports/listReportsForOrg silently exclude INTERNAL reports for a client-portal user, even without an explicit type filter', async () => {
      const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
      const list = await listReports(clientCtx!, clientId)
      expect(list.every((r) => r.type === 'CLIENT')).toBe(true)

      const orgList = await listReportsForOrg(clientCtx!)
      expect(orgList.every((r) => r.type === 'CLIENT')).toBe(true)
    })
  })
})
