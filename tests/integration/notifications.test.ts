import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db/client'
import { createApproval } from '@/lib/approvals/approvals'
import { recordIntegrationSuccess, recordIntegrationFailure, connectClientToProviderAccount } from '@/lib/integrations/health'
import { persistRecommendations } from '@/lib/recommendations/persist'
import { completeWorkflowRun, getOrCreateWorkflow, startWorkflowRun } from '@/lib/workflows/runs'
import { resolveAuthContext } from '@/lib/rbac/context'
import {
  countUnreadNotifications,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  notifyRecipients,
} from '@/lib/notifications/service'
import { resolveClientAndAdminRecipients, resolveClientStaffRecipients, resolveOrgAdminRecipients } from '@/lib/notifications/recipients'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Phase 4 of the automation roadmap (BRD Section 64/106): the notification
 * delivery layer (`src/lib/notifications/`) and its four trigger points
 * (createApproval, completeWorkflowRun, recordIntegrationFailure,
 * persistRecommendations). Deliberately hits the real DB and the real
 * trigger functions, not a mocked `notifyRecipients` - a passing test here
 * means an actual `Notification` row was written by actual application
 * code doing something else (creating an approval, failing a workflow),
 * not by a test calling the notification service directly.
 */
describe('Notifications (Phase 4)', () => {
  let orgId: string
  let clientId: string
  let staffUserId: string
  let staffOrgUserId: string
  let adminUserId: string
  let disabledStaffUserId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Notifications Test Client')
    clientId = client.id

    const admin = await createTestUser()
    adminUserId = admin.id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: adminUserId, roleId: roles.get('super_admin')!.id } })

    const staff = await createTestUser()
    staffUserId = staff.id
    const staffMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: staffUserId, roleId: roles.get('employee')!.id },
    })
    staffOrgUserId = staffMembership.id
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: staffOrgUserId } })

    // Assigned but DISABLED - must never receive a notification.
    const disabledStaff = await createTestUser({ status: 'DISABLED' })
    disabledStaffUserId = disabledStaff.id
    const disabledMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: disabledStaffUserId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: disabledMembership.id } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [staffUserId, adminUserId, disabledStaffUserId])
  })

  describe('recipient resolution', () => {
    it('resolveClientStaffRecipients includes only ACTIVE assigned staff, never a disabled one', async () => {
      const recipients = await resolveClientStaffRecipients(clientId)
      expect(recipients.map((r) => r.userId)).toEqual([staffUserId])
    })

    it('resolveOrgAdminRecipients includes only ACTIVE super_admins', async () => {
      const recipients = await resolveOrgAdminRecipients(orgId)
      expect(recipients.map((r) => r.userId)).toEqual([adminUserId])
    })

    it('resolveClientAndAdminRecipients dedupes and unions both sets', async () => {
      const recipients = await resolveClientAndAdminRecipients(orgId, clientId)
      expect(new Set(recipients.map((r) => r.userId))).toEqual(new Set([staffUserId, adminUserId]))
    })

    it('resolveClientStaffRecipients also includes the client\'s account manager, even without a ClientAssignment row', async () => {
      const employeeRole = await testDb.role.findFirstOrThrow({ where: { organizationId: orgId, key: 'employee' } })
      const accountManager = await createTestUser()
      const amMembership = await testDb.organizationUser.create({
        data: { organizationId: orgId, userId: accountManager.id, roleId: employeeRole.id },
      })
      const client = await createTestClient(orgId, 'AM Client')
      await testDb.client.update({ where: { id: client.id }, data: { accountManagerId: amMembership.id } })

      const recipients = await resolveClientStaffRecipients(client.id)
      expect(recipients.map((r) => r.userId)).toEqual([accountManager.id])

      await testDb.client.delete({ where: { id: client.id } })
      await testDb.organizationUser.delete({ where: { id: amMembership.id } })
      await testDb.user.delete({ where: { id: accountManager.id } })
    })
  })

  describe('notifyRecipients + read/unread lifecycle', () => {
    it('writes one IN_APP row per recipient, and an additional EMAIL row only when email is requested', async () => {
      await notifyRecipients({
        organizationId: orgId,
        clientId,
        recipients: [{ userId: staffUserId, email: 'x@example.test', name: 'X' }],
        type: 'APPROVAL_REQUIRED',
        title: 'Test in-app only',
        link: '/dashboard/approvals',
      })
      const inAppOnly = await db.notification.findMany({ where: { userId: staffUserId, title: 'Test in-app only' } })
      expect(inAppOnly).toHaveLength(1)
      expect(inAppOnly[0]!.channel).toBe('IN_APP')

      await notifyRecipients({
        organizationId: orgId,
        clientId,
        recipients: [{ userId: staffUserId, email: 'x@example.test', name: 'X' }],
        type: 'APPROVAL_REQUIRED',
        title: 'Test in-app and email',
        link: '/dashboard/approvals',
        email: true,
      })
      const both = await db.notification.findMany({ where: { userId: staffUserId, title: 'Test in-app and email' } })
      expect(both.map((n) => n.channel).sort()).toEqual(['EMAIL', 'IN_APP'])

      await db.notification.deleteMany({ where: { userId: staffUserId, title: { in: ['Test in-app only', 'Test in-app and email'] } } })
    })

    it('never throws even if the underlying write fails - notifications are a side effect, not the operation itself', async () => {
      // A real constraint violation (organizationId FK) rather than a
      // mocked Prisma method - avoids fighting Prisma's model delegate to
      // spy/restore cleanly, and proves the actual failure path.
      await expect(
        notifyRecipients({
          organizationId: 'org-that-does-not-exist',
          recipients: [{ userId: staffUserId, email: 'x@example.test', name: 'X' }],
          type: 'APPROVAL_REQUIRED',
          title: 'Should not throw',
        }),
      ).resolves.toBeUndefined()
    })

    it('listNotificationsForUser / countUnreadNotifications / markNotificationRead / markAllNotificationsRead', async () => {
      const ctx = await resolveAuthContext(testDb, staffUserId, orgId)
      await notifyRecipients({
        organizationId: orgId,
        clientId,
        recipients: [{ userId: staffUserId, email: 'x@example.test', name: 'X' }],
        type: 'APPROVAL_REQUIRED',
        title: 'Lifecycle test A',
      })
      await notifyRecipients({
        organizationId: orgId,
        clientId,
        recipients: [{ userId: staffUserId, email: 'x@example.test', name: 'X' }],
        type: 'APPROVAL_REQUIRED',
        title: 'Lifecycle test B',
      })

      const before = await countUnreadNotifications(ctx!)
      expect(before).toBeGreaterThanOrEqual(2)

      const list = await listNotificationsForUser(ctx!, { unreadOnly: true })
      const first = list.find((n) => n.title === 'Lifecycle test A')!
      await markNotificationRead(ctx!, first.id)
      const afterOne = await countUnreadNotifications(ctx!)
      expect(afterOne).toBe(before - 1)

      const markedCount = await markAllNotificationsRead(ctx!)
      expect(markedCount).toBeGreaterThanOrEqual(1)
      expect(await countUnreadNotifications(ctx!)).toBe(0)

      await db.notification.deleteMany({ where: { userId: staffUserId, title: { in: ['Lifecycle test A', 'Lifecycle test B'] } } })
    })

    it('markNotificationRead is idempotent for an already-read notification', async () => {
      const ctx = await resolveAuthContext(testDb, staffUserId, orgId)
      const n = await db.notification.create({
        data: { organizationId: orgId, userId: staffUserId, channel: 'IN_APP', type: 'APPROVAL_REQUIRED', title: 'Already read' },
      })
      const readOnce = await markNotificationRead(ctx!, n.id)
      const readTwice = await markNotificationRead(ctx!, n.id)
      expect(readOnce.readAt).toEqual(readTwice.readAt)
      await db.notification.delete({ where: { id: n.id } })
    })
  })

  describe('trigger: createApproval -> APPROVAL_REQUIRED', () => {
    afterEach(async () => {
      await db.notification.deleteMany({ where: { type: 'APPROVAL_REQUIRED', clientId } })
      await db.approval.deleteMany({ where: { clientId } })
    })

    it('notifies assigned staff, with an email row for HIGH risk', async () => {
      await createApproval({
        organizationId: orgId,
        clientId,
        requestedBy: staffUserId,
        actionType: 'test.action',
        riskLevel: 'HIGH',
        actionSummary: 'Test HIGH approval',
      })
      const notifications = await db.notification.findMany({ where: { userId: staffUserId, type: 'APPROVAL_REQUIRED' } })
      expect(notifications.some((n) => n.channel === 'IN_APP')).toBe(true)
      expect(notifications.some((n) => n.channel === 'EMAIL')).toBe(true)
      expect(notifications[0]!.link).toBe('/dashboard/approvals')
    })

    it('notifies in-app only (no email) for MEDIUM risk', async () => {
      await createApproval({
        organizationId: orgId,
        clientId,
        requestedBy: staffUserId,
        actionType: 'test.action',
        riskLevel: 'MEDIUM',
        actionSummary: 'Test MEDIUM approval',
      })
      const notifications = await db.notification.findMany({ where: { userId: staffUserId, type: 'APPROVAL_REQUIRED' } })
      expect(notifications.every((n) => n.channel === 'IN_APP')).toBe(true)
    })
  })

  describe('trigger: completeWorkflowRun -> WORKFLOW_FAILED', () => {
    let workflowId: string

    beforeAll(async () => {
      const workflow = await getOrCreateWorkflow(orgId, 'notification_test_workflow', 'Notification Test Workflow', { steps: [] })
      workflowId = workflow.id
    })

    afterEach(async () => {
      await db.notification.deleteMany({ where: { type: 'WORKFLOW_FAILED', clientId } })
    })

    it('notifies client staff + org admins when a run FAILS, never when it SUCCEEDS', async () => {
      const failedRun = await startWorkflowRun({ organizationId: orgId, clientId, workflowId, triggeredBy: staffUserId })
      await completeWorkflowRun(failedRun.id, 'FAILED', 'Simulated failure for test')
      const failedNotifications = await db.notification.findMany({ where: { type: 'WORKFLOW_FAILED', clientId } })
      expect(new Set(failedNotifications.map((n) => n.userId))).toEqual(new Set([staffUserId, adminUserId]))
      expect(failedNotifications.every((n) => n.body === 'Simulated failure for test')).toBe(true)

      const succeededRun = await startWorkflowRun({ organizationId: orgId, clientId, workflowId, triggeredBy: staffUserId })
      await completeWorkflowRun(succeededRun.id, 'SUCCEEDED')
      const afterSuccess = await db.notification.findMany({ where: { type: 'WORKFLOW_FAILED', clientId } })
      expect(afterSuccess).toHaveLength(failedNotifications.length) // unchanged
    })
  })

  describe('trigger: recordIntegrationFailure -> INTEGRATION_CRITICAL_FAILURE', () => {
    let connectionId: string

    beforeAll(async () => {
      const connection = await connectClientToProviderAccount({
        organizationId: orgId,
        clientId,
        provider: 'GOOGLE_ADS',
        externalAccountId: 'mock-gads-notif-test',
        createdBy: 'test',
      })
      connectionId = connection.id
      await recordIntegrationSuccess(connectionId) // starts CONNECTED, not ERROR
    })

    afterEach(async () => {
      await db.notification.deleteMany({ where: { type: 'INTEGRATION_CRITICAL_FAILURE', clientId } })
    })

    it('notifies once on the transition into ERROR, never again while it stays ERROR', async () => {
      await recordIntegrationFailure(connectionId, 'First failure')
      const afterFirst = await db.notification.findMany({ where: { type: 'INTEGRATION_CRITICAL_FAILURE', clientId } })
      expect(new Set(afterFirst.map((n) => n.userId))).toEqual(new Set([staffUserId, adminUserId]))

      await recordIntegrationFailure(connectionId, 'Second failure, still ERROR')
      const afterSecond = await db.notification.findMany({ where: { type: 'INTEGRATION_CRITICAL_FAILURE', clientId } })
      expect(afterSecond).toHaveLength(afterFirst.length) // no duplicate notification

      // Recovering and failing again should notify a second time.
      await recordIntegrationSuccess(connectionId)
      await recordIntegrationFailure(connectionId, 'Third failure, fresh transition')
      const afterThird = await db.notification.findMany({ where: { type: 'INTEGRATION_CRITICAL_FAILURE', clientId } })
      expect(afterThird.length).toBeGreaterThan(afterFirst.length)
    })
  })

  describe('trigger: persistRecommendations -> HIGH_PRIORITY_RECOMMENDATION', () => {
    afterEach(async () => {
      await db.notification.deleteMany({ where: { type: 'HIGH_PRIORITY_RECOMMENDATION', clientId } })
      await db.recommendation.deleteMany({ where: { clientId } })
      await db.aiRun.deleteMany({ where: { clientId } })
    })

    async function fakeAiRun() {
      const run = await db.aiRun.create({ data: { organizationId: orgId, clientId, model: 'test', promptVersion: 'test/v1', status: 'SUCCEEDED' } })
      return run.id
    }

    it('notifies for a HIGH/CRITICAL recommendation, never for LOW/MEDIUM only', async () => {
      const ctx = await resolveAuthContext(testDb, staffUserId, orgId)
      const aiRunId = await fakeAiRun()
      await persistRecommendations(ctx!, clientId, aiRunId, [
        { priority: 'HIGH', area: 'Google Ads', finding: 'CPA spike', evidence: ['cpa: 40'], recommendation: 'Review keywords', confidence: 0.8, requiresApproval: true },
        { priority: 'LOW', area: 'Instagram', finding: 'Minor dip', evidence: ['er: 1.1%'], recommendation: 'Monitor', confidence: 0.5, requiresApproval: false },
      ])
      const notifications = await db.notification.findMany({ where: { type: 'HIGH_PRIORITY_RECOMMENDATION', clientId } })
      expect(notifications.map((n) => n.userId)).toEqual([staffUserId])
      expect(notifications[0]!.link).toBe('/dashboard/recommendations')
    })

    it('does not notify when every recommendation is LOW/MEDIUM', async () => {
      const ctx = await resolveAuthContext(testDb, staffUserId, orgId)
      const aiRunId = await fakeAiRun()
      await persistRecommendations(ctx!, clientId, aiRunId, [
        { priority: 'MEDIUM', area: 'SEO', finding: 'Ranking drift', evidence: ['pos: 12'], recommendation: 'Refresh content', confidence: 0.6, requiresApproval: false },
      ])
      const notifications = await db.notification.findMany({ where: { type: 'HIGH_PRIORITY_RECOMMENDATION', clientId } })
      expect(notifications).toHaveLength(0)
    })
  })
})
