import type Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { updateClientPolicy } from '@/lib/clients/brain'
import { db } from '@/lib/db/client'
import {
  enqueueWeeklyIntelligenceJob,
  getWeeklyIntelligenceQueue,
  resetWeeklyIntelligenceQueueForTests,
} from '@/lib/queue/weekly-intelligence-queue'
import { resolveAutomationActor } from '@/lib/queue/resolve-actor'
import {
  createWeeklyIntelligenceWorker,
  findClientsDueForWeeklyIntelligence,
  processWeeklyIntelligenceJob,
} from '@/lib/queue/weekly-intelligence-worker'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Weekly automated intelligence (BRD Section 65, the last Phase 2 backlog
 * item - BRD Section 85). Runs against a REAL local Redis (this sandbox
 * has one - unlike every other "not live-verified" integration this
 * session, the queue mechanics themselves are genuinely exercised end to
 * end here, not mocked). Only the Claude call is mocked, same as every
 * other agent-workflow test - see docs/DECISIONS.md for the full
 * architecture writeup (deployment topology, the resolveAutomationActor
 * design, the weekly-only scope).
 */

const VALID_ANALYSIS_OUTPUT = {
  summary: 'Performance is broadly stable; one channel is underperforming.',
  recommendations: [],
}

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
  setAnthropicClientForTests({ messages: { parse } } as unknown as Anthropic)
  return parse
}

describe('Weekly automated intelligence (Phase 2, BRD Section 65/85)', () => {
  let orgId: string
  let clientId: string
  let superAdminId: string
  let accountManagerId: string
  let marketingEmployeeId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Weekly Intelligence Client')
    clientId = client.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const accountManager = await createTestUser()
    accountManagerId = accountManager.id
    const amMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: accountManagerId, roleId: roles.get('account_manager')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: amMembership.id } })

    const marketingEmployee = await createTestUser()
    marketingEmployeeId = marketingEmployee.id
    const meMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: marketingEmployeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: meMembership.id } })
  })

  afterAll(async () => {
    await getWeeklyIntelligenceQueue().obliterate({ force: true })
    await getWeeklyIntelligenceQueue().close()
    resetWeeklyIntelligenceQueueForTests()
    await db.aiRun.deleteMany({ where: { organizationId: orgId } })
    await cleanupOrg(orgId, [superAdminId, accountManagerId, marketingEmployeeId])
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  describe('resolveAutomationActor', () => {
    it('prefers an assigned account_manager over a marketing_employee', async () => {
      const ctx = await resolveAutomationActor(orgId, clientId)
      expect(ctx?.userId).toBe(accountManagerId)
    })

    it('falls back to marketing_employee when no account_manager is assigned', async () => {
      const soloClient = await createTestClient(orgId, 'Solo Employee Client')
      const meMembership = await testDb.organizationUser.findFirstOrThrow({ where: { userId: marketingEmployeeId } })
      await testDb.clientAssignment.create({ data: { clientId: soloClient.id, organizationUserId: meMembership.id } })

      const ctx = await resolveAutomationActor(orgId, soloClient.id)
      expect(ctx?.userId).toBe(marketingEmployeeId)
    })

    it('returns null (never a fabricated actor) when nobody eligible is assigned', async () => {
      const unassignedClient = await createTestClient(orgId, 'Unassigned Client')
      const ctx = await resolveAutomationActor(orgId, unassignedClient.id)
      expect(ctx).toBeNull()
    })
  })

  describe('findClientsDueForWeeklyIntelligence', () => {
    it('only returns clients opted in via ClientPolicy.weeklyAutomationEnabled', async () => {
      const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)
      await updateClientPolicy(superAdminCtx!, clientId, { weeklyAutomationEnabled: true })

      const due = await findClientsDueForWeeklyIntelligence()
      expect(due.some((d) => d.clientId === clientId)).toBe(true)
    })

    it('excludes a client with a SUCCEEDED analyze_client_performance run in the last 7 days (BRD Section 57 idempotency), but not one with only a FAILED run', async () => {
      const workflow = await db.workflow.upsert({
        where: { organizationId_key: { organizationId: orgId, key: 'analyze_client_performance' } },
        update: {},
        create: { organizationId: orgId, key: 'analyze_client_performance', name: 'Analyze Client Performance', definition: {} },
      })

      const succeededClient = await createTestClient(orgId, 'Recently Succeeded Client')
      const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)
      await updateClientPolicy(superAdminCtx!, succeededClient.id, { weeklyAutomationEnabled: true })
      await db.workflowRun.create({
        data: {
          organizationId: orgId,
          clientId: succeededClient.id,
          workflowId: workflow.id,
          status: 'SUCCEEDED',
          triggeredBy: superAdminId,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      })

      const failedClient = await createTestClient(orgId, 'Recently Failed Client')
      await updateClientPolicy(superAdminCtx!, failedClient.id, { weeklyAutomationEnabled: true })
      await db.workflowRun.create({
        data: {
          organizationId: orgId,
          clientId: failedClient.id,
          workflowId: workflow.id,
          status: 'FAILED',
          triggeredBy: superAdminId,
          startedAt: new Date(),
          completedAt: new Date(),
          error: 'Simulated failure.',
        },
      })

      const due = await findClientsDueForWeeklyIntelligence()
      const dueIds = due.map((d) => d.clientId)
      expect(dueIds).not.toContain(succeededClient.id)
      expect(dueIds).toContain(failedClient.id)
    })
  })

  describe('processWeeklyIntelligenceJob', () => {
    it('runs the analysis as the resolved account_manager, producing a real WorkflowRun/AiRun', async () => {
      const parse = mockClaudeParse()
      parse.mockResolvedValueOnce({ parsed_output: VALID_ANALYSIS_OUTPUT, usage: fakeUsage() })

      await processWeeklyIntelligenceJob({ organizationId: orgId, clientId })

      const run = await db.workflowRun.findFirstOrThrow({
        where: { organizationId: orgId, clientId, workflow: { key: 'analyze_client_performance' } },
        orderBy: { startedAt: 'desc' },
      })
      expect(run.status).toBe('SUCCEEDED')
      expect(run.triggeredBy).toBe(accountManagerId) // attributed to the real assigned staff member, not a fabricated actor
    })

    it('records a DENIED audit event and returns without throwing when nobody is assigned to run it as', async () => {
      const unassignedClient = await createTestClient(orgId, 'Unassigned Job Client')

      await expect(processWeeklyIntelligenceJob({ organizationId: orgId, clientId: unassignedClient.id })).resolves.toBeUndefined()

      const audit = await db.auditEvent.findFirst({
        where: { organizationId: orgId, clientId: unassignedClient.id, action: 'workflow.weekly_intelligence.skipped' },
      })
      expect(audit?.result).toBe('DENIED')
    })
  })

  describe('queue + real BullMQ worker round trip (real local Redis, not mocked)', () => {
    it('enqueueing the same client twice in the same ISO week is a no-op (BRD Section 57 - jobId-based idempotency)', async () => {
      const dedupClient = await createTestClient(orgId, 'Dedup Client')
      await enqueueWeeklyIntelligenceJob(orgId, dedupClient.id)
      await enqueueWeeklyIntelligenceJob(orgId, dedupClient.id)

      const jobs = await getWeeklyIntelligenceQueue().getJobs(['waiting', 'delayed', 'active', 'completed'])
      expect(jobs.filter((j) => j.data.clientId === dedupClient.id)).toHaveLength(1)
    })

    it('a real Worker processes an enqueued job end-to-end', async () => {
      const parse = mockClaudeParse()
      parse.mockResolvedValue({ parsed_output: VALID_ANALYSIS_OUTPUT, usage: fakeUsage() })

      const roundTripClient = await createTestClient(orgId, 'Round Trip Client')
      const amMembership = await testDb.organizationUser.findFirstOrThrow({ where: { userId: accountManagerId } })
      await testDb.clientAssignment.create({ data: { clientId: roundTripClient.id, organizationUserId: amMembership.id } })

      const worker = createWeeklyIntelligenceWorker()
      try {
        const completed = new Promise<void>((resolve, reject) => {
          worker.on('completed', (job) => {
            if (job.data.clientId === roundTripClient.id) resolve()
          })
          worker.on('failed', (job, err) => {
            if (job?.data.clientId === roundTripClient.id) reject(err)
          })
        })

        await enqueueWeeklyIntelligenceJob(orgId, roundTripClient.id)
        await completed

        const run = await db.workflowRun.findFirstOrThrow({
          where: { organizationId: orgId, clientId: roundTripClient.id, workflow: { key: 'analyze_client_performance' } },
        })
        expect(run.status).toBe('SUCCEEDED')
      } finally {
        await worker.close()
      }
    }, 15000)
  })
})
