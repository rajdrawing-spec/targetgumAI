import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/cron/weekly-intelligence/route'
import { updateClientPolicy } from '@/lib/clients/brain'
import { getWeeklyIntelligenceQueue, resetWeeklyIntelligenceQueueForTests } from '@/lib/queue/weekly-intelligence-queue'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * The cron trigger route (`src/app/api/cron/weekly-intelligence/route.ts`)
 * is a plain exported `GET(request: Request)` function - callable
 * directly in a test without a running Next.js server, same as any other
 * library function. CRON_SECRET is already set in this environment's
 * .env.local (see docs/EXTERNAL-APPROVALS.md-style local dev conventions).
 */
describe('GET /api/cron/weekly-intelligence', () => {
  let orgId: string
  let clientId: string
  let superAdminId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Cron Route Client')
    clientId = client.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await updateClientPolicy(ctx!, clientId, { weeklyAutomationEnabled: true })
  })

  afterAll(async () => {
    await getWeeklyIntelligenceQueue().obliterate({ force: true })
    await getWeeklyIntelligenceQueue().close()
    resetWeeklyIntelligenceQueueForTests()
    await cleanupOrg(orgId, [superAdminId])
  })

  it('rejects a request with no or a wrong CRON_SECRET', async () => {
    const noAuth = await GET(new Request('http://localhost/api/cron/weekly-intelligence'))
    expect(noAuth.status).toBe(401)

    const wrongAuth = await GET(
      new Request('http://localhost/api/cron/weekly-intelligence', { headers: { authorization: 'Bearer wrong-secret' } }),
    )
    expect(wrongAuth.status).toBe(401)
  })

  it('enqueues every due, opted-in client when the correct CRON_SECRET is presented', async () => {
    const res = await GET(
      new Request('http://localhost/api/cron/weekly-intelligence', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { enqueued: number }
    expect(body.enqueued).toBeGreaterThanOrEqual(1)

    const jobs = await getWeeklyIntelligenceQueue().getJobs(['waiting', 'delayed', 'active', 'completed'])
    expect(jobs.some((j) => j.data.clientId === clientId)).toBe(true)
  })

  it('does not fabricate a run for a client with weeklyAutomationEnabled left false', async () => {
    const optedOutClient = await createTestClient(orgId, 'Opted Out Client')

    await GET(new Request('http://localhost/api/cron/weekly-intelligence', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))

    const jobs = await getWeeklyIntelligenceQueue().getJobs(['waiting', 'delayed', 'active', 'completed'])
    expect(jobs.some((j) => j.data.clientId === optedOutClient.id)).toBe(false)
  })
})
