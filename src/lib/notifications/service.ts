import { db } from '@/lib/db/client'
import { sendMail } from '@/lib/email/mailer'
import { appUrl } from '@/lib/users/invitations'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import type { NotificationRecipient } from './recipients'

/**
 * Notifications (BRD-PRD Section 64/106): "Notify for: Approval required,
 * Critical integration failure, High-priority campaign issue, Workflow
 * failure, Scheduled report, Important client activity" - "Escalation
 * should prevent important failures from being buried." This is the
 * delivery layer every trigger site (createApproval, completeWorkflowRun,
 * recordIntegrationFailure, persistRecommendations) calls into; recipient
 * selection lives in `./recipients.ts`.
 *
 * Deliberately best-effort: a notification is a side effect of something
 * that already happened, never the thing itself. `notifyRecipients` never
 * throws - a broken SMTP config or a bad row must not fail the approval/
 * workflow/integration-health write that triggered it.
 */

export type NotificationType =
  | 'APPROVAL_REQUIRED'
  | 'WORKFLOW_FAILED'
  | 'INTEGRATION_CRITICAL_FAILURE'
  | 'HIGH_PRIORITY_RECOMMENDATION'

export interface NotifyInput {
  organizationId: string
  clientId?: string
  recipients: NotificationRecipient[]
  type: NotificationType
  title: string
  body?: string
  /** Relative in-app path, e.g. "/dashboard/approvals". */
  link?: string
  /** Send an email as well as the in-app row - reserved for the notifications worth interrupting someone's inbox for. */
  email?: boolean
}

function emailBody(title: string, body: string | undefined, link: string | undefined): { text: string; html: string } {
  const fullLink = link ? `${appUrl()}${link}` : undefined
  const text = [title, body, fullLink ? `View: ${fullLink}` : undefined].filter(Boolean).join('\n\n')
  const html = `<p><strong>${title}</strong></p>${body ? `<p>${body}</p>` : ''}${fullLink ? `<p><a href="${fullLink}">View in TargetGum</a></p>` : ''}`
  return { text, html }
}

/**
 * Fans a notification out to every recipient: always an `IN_APP` row
 * (what the bell/`/dashboard/notifications` reads), and - only when
 * `email` is true - an attempted email plus its own `EMAIL`-channel row
 * as a delivery record (its `readAt` has no meaning for email and is left
 * null). Never throws: every per-recipient failure is caught and logged,
 * not propagated - see the file doc comment.
 */
export async function notifyRecipients(input: NotifyInput): Promise<void> {
  if (input.recipients.length === 0) return

  for (const recipient of input.recipients) {
    try {
      await db.notification.create({
        data: {
          organizationId: input.organizationId,
          clientId: input.clientId,
          userId: recipient.userId,
          channel: 'IN_APP',
          type: input.type,
          title: input.title,
          body: input.body,
          link: input.link,
        },
      })
    } catch (error) {
      console.error(`[notifications] failed to write in-app notification for user ${recipient.userId}:`, error)
    }

    if (!input.email) continue
    try {
      // sendMail itself handles "not configured" (dev: logs locally and
      // returns; prod: throws, caught below) - no need to duplicate that
      // check here.
      const { text, html } = emailBody(input.title, input.body, input.link)
      await sendMail({ to: recipient.email, subject: input.title, text, html })
      await db.notification.create({
        data: {
          organizationId: input.organizationId,
          clientId: input.clientId,
          userId: recipient.userId,
          channel: 'EMAIL',
          type: input.type,
          title: input.title,
          body: input.body,
          link: input.link,
        },
      })
    } catch (error) {
      console.error(`[notifications] failed to email user ${recipient.userId}:`, error)
    }
  }
}

/**
 * The signed-in user's own notifications - never anyone else's. `userId`
 * always comes from `ctx`, never a caller-supplied parameter: a
 * notification's own existence for this user IS the authorization
 * boundary, there is no separate permission to hold.
 */
export async function listNotificationsForUser(
  ctx: AuthContext,
  filter: { unreadOnly?: boolean; limit?: number } = {},
) {
  return db.notification.findMany({
    where: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      channel: 'IN_APP',
      ...(filter.unreadOnly && { readAt: null }),
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
  })
}

export async function countUnreadNotifications(ctx: AuthContext): Promise<number> {
  return db.notification.count({
    where: { organizationId: ctx.organizationId, userId: ctx.userId, channel: 'IN_APP', readAt: null },
  })
}

async function getOwnedNotification(ctx: AuthContext, notificationId: string) {
  const notification = await db.notification.findUnique({ where: { id: notificationId } })
  if (!notification || notification.organizationId !== ctx.organizationId || notification.userId !== ctx.userId) {
    throw new ForbiddenError('Not authorized for this notification.')
  }
  return notification
}

export async function markNotificationRead(ctx: AuthContext, notificationId: string) {
  const notification = await getOwnedNotification(ctx, notificationId)
  if (notification.readAt) return notification
  return db.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } })
}

export async function markAllNotificationsRead(ctx: AuthContext): Promise<number> {
  const result = await db.notification.updateMany({
    where: { organizationId: ctx.organizationId, userId: ctx.userId, channel: 'IN_APP', readAt: null },
    data: { readAt: new Date() },
  })
  return result.count
}
