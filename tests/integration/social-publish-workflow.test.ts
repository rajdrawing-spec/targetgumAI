import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { registerMetricoolTools } from '@/lib/integrations/metricool/tools'
import {
  createContentCalendarItem,
  publishContentCalendarItem,
  scheduleContentCalendarItem,
  submitContentForReview,
  syncContentCalendarItemFromApproval,
  approveContentCalendarItem,
} from '@/lib/content-calendar/persist'
import { db } from '@/lib/db/client'
import { rejectApproval } from '@/lib/approvals/approvals'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { ApprovalRequiredError } from '@/lib/tools/errors'
import { approveAndExecuteApproval, executeTool } from '@/lib/tools/execute'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * "Automated social scheduling" (Phase 2, BRD Section 85): the real
 * publish action `metricool.publish_post` (HIGH risk, BRD Section 21),
 * and the general Approval-Engine execution gap this surfaced - approving
 * a HIGH/CRITICAL tool-call approval never actually ran the tool anywhere
 * in this app before `approveAndExecuteApproval`. docs/DECISIONS.md has
 * the full account.
 */
describe('Automated social scheduling: metricool.publish_post + approveAndExecuteApproval (Phase 2, BRD Section 21/85)', () => {
  let orgId: string
  let clientId: string
  let accountManagerId: string
  let marketingEmployeeId: string
  let clientUserId: string

  async function scheduledItemFor(userId: string) {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const item = await createContentCalendarItem(ctx!, clientId, {
      platform: 'instagram',
      publishDate: new Date('2026-06-01T10:00:00Z'),
      caption: 'Publish workflow test post',
    })
    await submitContentForReview(ctx!, item.id)
    await approveContentCalendarItem(ctx!, item.id)
    return scheduleContentCalendarItem(ctx!, item.id, { networks: ['instagram'] })
  }

  beforeAll(async () => {
    await registerMetricoolTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Publish Workflow Client')
    clientId = client.id

    // Two separately-assigned employees - account_manager/marketing_employee
    // merged into one `employee` role (docs/DECISIONS.md, 2026-09-13), so
    // both hold identical permissions; kept as two users below so requesting
    // and approving can still be exercised as two different people.
    const accountManager = await createTestUser()
    accountManagerId = accountManager.id
    const amMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: accountManagerId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: amMembership.id } })

    const marketingEmployee = await createTestUser()
    marketingEmployeeId = marketingEmployee.id
    const meMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: marketingEmployeeId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: meMembership.id } })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'METRICOOL',
      externalAccountId: 'mock-brand-publish',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(connection.id)
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: { startsWith: 'metricool.' } } } })
    await cleanupOrg(orgId, [accountManagerId, marketingEmployeeId, clientUserId])
  })

  it('metricool.publish_post is HIGH risk and never executes on a fresh call - it always creates a PENDING approval', async () => {
    const item = await scheduledItemFor(marketingEmployeeId)
    const ctx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    await expect(
      executeTool({
        ctx: ctx!,
        toolKey: 'metricool.publish_post',
        clientId,
        input: { providerPostId: item.providerPostId! },
      }),
    ).rejects.toThrow(ApprovalRequiredError)
  })

  it('publishContentCalendarItem records the approval id and leaves the item SCHEDULED, not a new status', async () => {
    const item = await scheduledItemFor(marketingEmployeeId)
    const ctx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)

    const updated = await publishContentCalendarItem(ctx!, item.id)
    expect(updated.status).toBe('SCHEDULED')
    expect(updated.approvalId).toBeTruthy()

    const approval = await db.approval.findUniqueOrThrow({ where: { id: updated.approvalId! } })
    expect(approval.riskLevel).toBe('HIGH')
    expect(approval.status).toBe('PENDING')

    // Calling it again while a request is already pending is refused, not a second approval.
    await expect(publishContentCalendarItem(ctx!, item.id)).rejects.toThrow('already pending')
  })

  it('the full loop: approveAndExecuteApproval actually runs the tool (the pre-existing gap this closes), and syncContentCalendarItemFromApproval flips the item to PUBLISHED', async () => {
    const item = await scheduledItemFor(marketingEmployeeId)
    const employeeCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const requested = await publishContentCalendarItem(employeeCtx!, item.id)
    const approvalId = requested.approvalId!

    // A second employee approves.
    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    const executed = await approveAndExecuteApproval(amCtx!, approvalId)
    expect(executed.status).toBe('EXECUTED')

    await syncContentCalendarItemFromApproval(approvalId)
    const finalItem = await db.contentCalendarItem.findUniqueOrThrow({ where: { id: item.id } })
    expect(finalItem.status).toBe('PUBLISHED')

    // Prove the tool actually ran against the provider, not just that the approval row changed.
    const posts = (await executeTool({
      ctx: amCtx!,
      toolKey: 'metricool.get_posts',
      clientId,
      input: { from: '2026-01-01', to: '2026-12-31' },
    })) as Array<{ providerPostId: string; status: string }>
    const publishedPost = posts.find((p) => p.providerPostId === item.providerPostId)
    expect(publishedPost?.status).toBe('published')
  })

  it('rejecting the publish approval clears approvalId so the item can be retried, and leaves it SCHEDULED (not FAILED)', async () => {
    const item = await scheduledItemFor(marketingEmployeeId)
    const employeeCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const requested = await publishContentCalendarItem(employeeCtx!, item.id)
    const approvalId = requested.approvalId!

    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    await rejectApproval(amCtx!, approvalId, 'Not ready to publish yet.')
    await syncContentCalendarItemFromApproval(approvalId)

    const afterReject = await db.contentCalendarItem.findUniqueOrThrow({ where: { id: item.id } })
    expect(afterReject.status).toBe('SCHEDULED')
    expect(afterReject.approvalId).toBeNull()

    // Retry is now allowed.
    const retried = await publishContentCalendarItem(employeeCtx!, item.id)
    expect(retried.approvalId).toBeTruthy()
  })

  it('approveAndExecuteApproval leaves a non-tool-call approval (e.g. a routed recommendation) as approved-only, exactly like approveApproval always did', async () => {
    const nonToolApproval = await db.approval.create({
      data: {
        organizationId: orgId,
        clientId,
        requestedBy: marketingEmployeeId,
        actionType: 'recommendation:Instagram',
        riskLevel: 'HIGH',
        actionSummary: 'Not a tool call - no toolKey in proposedChanges.',
        proposedChanges: { recommendationId: 'fake-id' },
        status: 'PENDING',
      },
    })
    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    const result = await approveAndExecuteApproval(amCtx!, nonToolApproval.id)
    expect(result.status).toBe('APPROVED') // never EXECUTED - nothing to execute
  })

  it('an employee can both request a publish and approve it themselves (approvals.approve is granted to every employee, docs/DECISIONS.md 2026-09-13)', async () => {
    const item = await scheduledItemFor(marketingEmployeeId)
    const employeeCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const requested = await publishContentCalendarItem(employeeCtx!, item.id)
    const executed = await approveAndExecuteApproval(employeeCtx!, requested.approvalId!)
    expect(executed.status).toBe('EXECUTED')
  })

  it('a client cannot request a publish at all (no content.manage)', async () => {
    const item = await scheduledItemFor(marketingEmployeeId)
    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(publishContentCalendarItem(clientCtx!, item.id)).rejects.toThrow(ForbiddenError)
  })
})
