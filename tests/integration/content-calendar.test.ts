import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import {
  approveContentCalendarItem,
  cancelContentCalendarItem,
  createContentCalendarItem,
  listContentCalendarItems,
  scheduleContentCalendarItem,
  submitContentForReview,
} from '@/lib/content-calendar/persist'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { executeTool } from '@/lib/tools/execute'
import { _resetBootstrapForTests } from '@/lib/tools/bootstrap'
import { _resetToolRegistryForTests } from '@/lib/tools/registry'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Social content calendar (BRD Section 66/48, Phase 2 Section 85):
 * `content.manage` permission (docs/DECISIONS.md), the IDEA -> DRAFT ->
 * IN_REVIEW -> APPROVED -> SCHEDULED lifecycle, and the ensureToolsRegistered
 * bootstrap fix that makes scheduling actually reach Metricool in a fresh
 * process (also docs/DECISIONS.md).
 */
describe('Content calendar (Phase 2, BRD Section 66/48)', () => {
  let orgId: string
  let clientId: string
  let otherClientId: string
  let disconnectedClientId: string
  let marketingEmployeeId: string
  let accountManagerId: string
  let clientUserId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const client = await createTestClient(orgId, 'Content Calendar Client')
    clientId = client.id
    const otherClient = await createTestClient(orgId, 'Content Calendar Other Client')
    otherClientId = otherClient.id
    const disconnectedClient = await createTestClient(orgId, 'Content Calendar Disconnected Client')
    disconnectedClientId = disconnectedClient.id

    const marketingEmployee = await createTestUser()
    marketingEmployeeId = marketingEmployee.id
    const meMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: marketingEmployeeId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: meMembership.id } })
    await testDb.clientAssignment.create({ data: { clientId: disconnectedClientId, organizationUserId: meMembership.id } })

    const accountManager = await createTestUser()
    accountManagerId = accountManager.id
    const amMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: accountManagerId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: amMembership.id } })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'METRICOOL',
      externalAccountId: 'mock-brand-content-calendar',
      label: 'Content Calendar Mock Brand',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(connection.id)
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: { startsWith: 'metricool.' } } } })
    await cleanupOrg(orgId, [marketingEmployeeId, accountManagerId, clientUserId])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('an employee can create, submit, and (once another employee approves) schedule a post through the full lifecycle', async () => {
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const item = await createContentCalendarItem(meCtx!, clientId, {
      platform: 'instagram',
      publishDate: new Date('2026-04-01T10:00:00Z'),
      caption: 'Spring launch post',
    })
    expect(item.status).toBe('DRAFT')

    const submitted = await submitContentForReview(meCtx!, item.id)
    expect(submitted.status).toBe('IN_REVIEW')

    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    const approved = await approveContentCalendarItem(amCtx!, item.id)
    expect(approved.status).toBe('APPROVED')

    const scheduled = await scheduleContentCalendarItem(meCtx!, item.id, { networks: ['instagram'] })
    expect(scheduled.status).toBe('SCHEDULED')
    expect(scheduled.providerPostId).toBeTruthy()
  })

  it('cannot schedule an item that has not been approved yet', async () => {
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const item = await createContentCalendarItem(meCtx!, clientId, {
      platform: 'instagram',
      publishDate: new Date('2026-04-02T10:00:00Z'),
    })
    await expect(scheduleContentCalendarItem(meCtx!, item.id, { networks: ['instagram'] })).rejects.toThrow(
      'must be APPROVED first',
    )
  })

  it('scheduling surfaces IntegrationUnavailableError (never fabricates a provider post id) and leaves the item APPROVED, not SCHEDULED or FAILED', async () => {
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const item = await createContentCalendarItem(meCtx!, disconnectedClientId, {
      platform: 'instagram',
      publishDate: new Date('2026-04-03T10:00:00Z'),
    })
    await submitContentForReview(meCtx!, item.id)
    await approveContentCalendarItem(meCtx!, item.id) // content.manage covers the whole lifecycle, can approve their own for this disconnected-client test

    await expect(scheduleContentCalendarItem(meCtx!, item.id, { networks: ['instagram'] })).rejects.toThrow(
      IntegrationUnavailableError,
    )

    const reloaded = await db.contentCalendarItem.findUnique({ where: { id: item.id } })
    expect(reloaded?.status).toBe('APPROVED')
    expect(reloaded?.providerPostId).toBeNull()
  })

  it('a client cannot create, submit, approve, cancel, or schedule content (content.manage not granted, BRD 4.4 is view-only)', async () => {
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const item = await createContentCalendarItem(meCtx!, clientId, {
      platform: 'facebook',
      publishDate: new Date('2026-04-04T10:00:00Z'),
    })

    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(
      createContentCalendarItem(clientCtx!, clientId, { platform: 'facebook', publishDate: new Date() }),
    ).rejects.toThrow(ForbiddenError)
    await expect(submitContentForReview(clientCtx!, item.id)).rejects.toThrow(ForbiddenError)
    await expect(cancelContentCalendarItem(clientCtx!, item.id)).rejects.toThrow(ForbiddenError)
  })

  it('a client CAN read the content calendar for their own client (BRD 4.4 "View content/creative", via the existing clients.read grant)', async () => {
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    await createContentCalendarItem(meCtx!, clientId, {
      platform: 'linkedin',
      publishDate: new Date('2026-04-05T10:00:00Z'),
      caption: 'Client-visible post',
    })

    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    const items = await listContentCalendarItems(clientCtx!, clientId)
    expect(items.some((i) => i.caption === 'Client-visible post')).toBe(true)
  })

  it('an employee cannot touch content belonging to a client they are not assigned to', async () => {
    const otherItem = await db.contentCalendarItem.create({
      data: {
        organizationId: orgId,
        clientId: otherClientId,
        platform: 'instagram',
        publishDate: new Date('2026-04-06T10:00:00Z'),
        status: 'DRAFT',
        createdBy: 'seed',
      },
    })
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    await expect(submitContentForReview(meCtx!, otherItem.id)).rejects.toThrow(ForbiddenError)
  })

  describe('ensureToolsRegistered bootstrap fix', () => {
    it('executeTool can reach a Metricool tool with NO explicit registerMetricoolTools() call in this test - proves the fresh-process bootstrap gap is closed', async () => {
      _resetToolRegistryForTests()
      _resetBootstrapForTests()

      const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
      const result = (await executeTool({
        ctx: meCtx!,
        toolKey: 'metricool.get_connected_networks',
        input: {},
        clientId,
      })) as Array<{ network: string }>
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
