import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listAiRuns } from '@/lib/ai/runs'
import { listAccessibleClients } from '@/lib/clients/list'
import { db } from '@/lib/db/client'
import { listIntegrationConnectionsForOrg, connectClientToProviderAccount } from '@/lib/integrations/health'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { resolveAuthContext } from '@/lib/rbac/context'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * The Day 13 dashboard's org-wide (cross-client) read helpers -
 * listAccessibleClients, listRecommendationsForOrg, listTasksForOrg,
 * listAiRuns, listIntegrationConnectionsForOrg. Each must respect the same
 * scoped-client-access rule as every other tenant-scoped read: a role
 * limited to Client A never sees Client B's rows, even when both are
 * fetched "org-wide" rather than through a single-client call.
 */
describe('Dashboard org-wide read helpers - tenant scoping', () => {
  let orgId: string
  let clientAId: string
  let clientBId: string
  let superAdminId: string
  let employeeId: string // marketing_employee, assigned to Client A only

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const clientA = await createTestClient(orgId, 'Dashboard Client A')
    const clientB = await createTestClient(orgId, 'Dashboard Client B')
    clientAId = clientA.id
    clientBId = clientB.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const employee = await createTestUser()
    employeeId = employee.id
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('marketing_employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId: clientAId, organizationUserId: membership.id } })

    // One recommendation, one task, one AI run, one integration connection per client.
    for (const clientId of [clientAId, clientBId]) {
      await testDb.recommendation.create({
        data: {
          organizationId: orgId,
          clientId,
          priority: 'HIGH',
          area: 'Google Ads',
          finding: `Finding for ${clientId}`,
          recommendation: 'Do something.',
          status: 'RECOMMENDED',
        },
      })
      await testDb.task.create({
        data: {
          organizationId: orgId,
          clientId,
          title: `Task for ${clientId}`,
          priority: 'MEDIUM',
          status: 'OPEN',
          createdBy: 'test',
        },
      })
      await testDb.aiRun.create({
        data: { organizationId: orgId, clientId, model: 'test-model', promptVersion: 'v1', status: 'SUCCEEDED' },
      })
      const connection = await connectClientToProviderAccount({
        organizationId: orgId,
        clientId,
        provider: 'METRICOOL',
        externalAccountId: `brand-${clientId}`,
        createdBy: 'test',
      })
      expect(connection.clientId).toBe(clientId)
    }
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId])
  })

  it('listAccessibleClients: super_admin sees both clients, marketing_employee sees only Client A', async () => {
    const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    const allClients = await listAccessibleClients(superCtx!)
    expect(allClients.map((c) => c.id).sort()).toEqual([clientAId, clientBId].sort())

    const empCtx = await resolveAuthContext(testDb, employeeId, orgId)
    const scopedClients = await listAccessibleClients(empCtx!)
    expect(scopedClients.map((c) => c.id)).toEqual([clientAId])
  })

  it('listRecommendationsForOrg: scoped role never sees the other client\'s recommendation', async () => {
    const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    const all = await listRecommendationsForOrg(superCtx!)
    expect(all.some((r) => r.clientId === clientAId)).toBe(true)
    expect(all.some((r) => r.clientId === clientBId)).toBe(true)

    const empCtx = await resolveAuthContext(testDb, employeeId, orgId)
    const scoped = await listRecommendationsForOrg(empCtx!)
    expect(scoped.every((r) => r.clientId === clientAId)).toBe(true)
    expect(scoped.some((r) => r.clientId === clientBId)).toBe(false)
  })

  it('listTasksForOrg: scoped role never sees the other client\'s task', async () => {
    const empCtx = await resolveAuthContext(testDb, employeeId, orgId)
    const scoped = await listTasksForOrg(empCtx!)
    expect(scoped.every((t) => t.clientId === clientAId)).toBe(true)
    expect(scoped.some((t) => t.clientId === clientBId)).toBe(false)
  })

  it('listAiRuns: scoped role never sees the other client\'s AI run', async () => {
    const empCtx = await resolveAuthContext(testDb, employeeId, orgId)
    const scoped = await listAiRuns(empCtx!)
    expect(scoped.every((r) => r.clientId === clientAId)).toBe(true)
    expect(scoped.some((r) => r.clientId === clientBId)).toBe(false)
  })

  it('listIntegrationConnectionsForOrg: scoped role never sees the other client\'s connection', async () => {
    const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    const all = await listIntegrationConnectionsForOrg(superCtx!)
    expect(all.some((c) => c.clientId === clientAId)).toBe(true)
    expect(all.some((c) => c.clientId === clientBId)).toBe(true)

    const empCtx = await resolveAuthContext(testDb, employeeId, orgId)
    const scoped = await listIntegrationConnectionsForOrg(empCtx!)
    expect(scoped.every((c) => c.clientId === clientAId)).toBe(true)
    expect(scoped.some((c) => c.clientId === clientBId)).toBe(false)
  })

  it('listAiRuns(clientId): denies a client the caller is not assigned to', async () => {
    const empCtx = await resolveAuthContext(testDb, employeeId, orgId)
    await expect(listAiRuns(empCtx!, { clientId: clientBId })).rejects.toThrow()
  })
})
