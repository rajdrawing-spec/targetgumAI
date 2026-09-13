import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { acceptRecommendation, listRecommendations, persistRecommendations, rejectRecommendation } from '@/lib/recommendations/persist'
import { createTaskFromRecommendation, listTasks } from '@/lib/recommendations/tasks'
import { routeRecommendation } from '@/lib/recommendations/route'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

const SAMPLE_RECS = [
  {
    priority: 'MEDIUM' as const,
    area: 'Instagram',
    finding: 'Engagement dipped 12% week over week.',
    evidence: ['engagement: 280 (was 318)'],
    recommendation: 'Test a Reel-heavy content mix next week.',
    confidence: 0.6,
    requiresApproval: false,
  },
  {
    priority: 'HIGH' as const,
    area: 'Google Ads',
    finding: 'CPA on Search Campaign X is 62% above target.',
    evidence: ['cpa: 19.40', 'target: 12.00'],
    likelyCause: 'Broad match driving low-intent traffic.',
    recommendation: 'Tighten match types and review search terms.',
    expectedImpact: 'Reduce CPA toward target within 2 weeks.',
    confidence: 0.78,
    requiresApproval: true,
  },
]

describe('Recommendations: persistence, lifecycle, task creation, routing (BRD Section 39-40, 107-108, 24)', () => {
  let orgId: string
  let clientId: string
  let superAdminId: string
  let clientUserId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Recommendations Test Client')
    clientId = client.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const clientPortalUser = await createTestUser()
    clientUserId = clientPortalUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, clientUserId])
  })

  it('persists a batch of recommendations with status RECOMMENDED', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const aiRun = await db.aiRun.create({
      data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'analytics/v1', status: 'SUCCEEDED' },
    })

    const saved = await persistRecommendations(ctx!, clientId, aiRun.id, SAMPLE_RECS)
    expect(saved).toHaveLength(2)
    expect(saved.every((r) => r.status === 'RECOMMENDED')).toBe(true)

    const listed = await listRecommendations(ctx!, clientId)
    expect(listed).toHaveLength(2)
  })

  it('acceptRecommendation transitions RECOMMENDED -> ACCEPTED', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const [rec] = await listRecommendations(ctx!, clientId, { status: 'RECOMMENDED' })
    const accepted = await acceptRecommendation(ctx!, rec!.id)
    expect(accepted.status).toBe('ACCEPTED')
  })

  it('rejectRecommendation transitions to REJECTED and records ClientFeedback (BRD Section 108)', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const [rec] = await listRecommendations(ctx!, clientId, { status: 'RECOMMENDED' })
    const rejected = await rejectRecommendation(ctx!, rec!.id, 'Client already tried this approach.')
    expect(rejected.status).toBe('REJECTED')
    expect(rejected.rejectionReason).toContain('already tried')

    const feedback = await db.clientFeedback.findFirst({
      where: { clientId, category: 'REJECTED_PATTERN' },
      orderBy: { createdAt: 'desc' },
    })
    expect(feedback?.content).toContain('already tried')
  })

  it('a client cannot create a task from a recommendation (tasks.create is staff-only, BRD Section 4.2-4.4)', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const aiRun = await db.aiRun.create({
      data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'analytics/v1', status: 'SUCCEEDED' },
    })
    const [rec] = await persistRecommendations(ctx!, clientId, aiRun.id, [SAMPLE_RECS[0]!])

    const clientUserCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(createTaskFromRecommendation(clientUserCtx!, rec!.id)).rejects.toThrow(ForbiddenError)
  })

  it('createTaskFromRecommendation builds a task with mapped priority and evidence in the description', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const aiRun = await db.aiRun.create({
      data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'analytics/v1', status: 'SUCCEEDED' },
    })
    const [rec] = await persistRecommendations(ctx!, clientId, aiRun.id, [SAMPLE_RECS[0]!])

    const task = await createTaskFromRecommendation(ctx!, rec!.id)
    expect(task.priority).toBe('MEDIUM')
    expect(task.title).toBe(SAMPLE_RECS[0]!.finding)
    expect(task.description).toContain('engagement: 280')
    expect(task.sourceRecommendationId).toBe(rec!.id)

    const tasks = await listTasks(ctx!, clientId)
    expect(tasks.some((t) => t.id === task.id)).toBe(true)
  })

  it('routeRecommendation sends a MEDIUM/no-approval recommendation to a task', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const aiRun = await db.aiRun.create({
      data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'analytics/v1', status: 'SUCCEEDED' },
    })
    const [rec] = await persistRecommendations(ctx!, clientId, aiRun.id, [SAMPLE_RECS[0]!])

    const result = await routeRecommendation(ctx!, rec!.id)
    expect(result.kind).toBe('task')
  })

  it('routeRecommendation sends a HIGH-priority/requiresApproval recommendation to an Approval, and links it back', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const aiRun = await db.aiRun.create({
      data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'analytics/v1', status: 'SUCCEEDED' },
    })
    const [rec] = await persistRecommendations(ctx!, clientId, aiRun.id, [SAMPLE_RECS[1]!])

    const result = await routeRecommendation(ctx!, rec!.id)
    expect(result.kind).toBe('approval')
    if (result.kind === 'approval') {
      const approval = await db.approval.findUniqueOrThrow({ where: { id: result.approvalId } })
      expect(approval.riskLevel).toBe('HIGH')
      expect(approval.status).toBe('PENDING')

      const updatedRec = await db.recommendation.findUniqueOrThrow({ where: { id: rec!.id } })
      expect(updatedRec.approvalId).toBe(result.approvalId)
    }
  })
})
