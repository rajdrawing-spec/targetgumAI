import { db } from '@/lib/db/client'

/**
 * Phase 4 (BRD Section 64/106): who should be notified about something
 * that happened on a given client. Deliberately reuses the existing
 * staffing model (`ClientAssignment`, `Client.accountManagerId`,
 * `Role.key === 'super_admin'`) rather than inventing a subscription/
 * preference system - the same "who can act on this client" set BRD
 * Section 4 already defines is also "who should hear about it."
 */

export interface NotificationRecipient {
  userId: string
  email: string
  name: string | null
}

function dedupe(recipients: NotificationRecipient[]): NotificationRecipient[] {
  const seen = new Map<string, NotificationRecipient>()
  for (const r of recipients) seen.set(r.userId, r)
  return Array.from(seen.values())
}

/**
 * Every ACTIVE employee assigned to this client, plus its designated
 * account manager if set (which need not itself be a `ClientAssignment`
 * row) - the staff who actually work this client day to day. Excludes
 * anyone whose `User` row is DISABLED, same guard `resolveAuthContext`
 * applies before granting access at all.
 */
export async function resolveClientStaffRecipients(clientId: string): Promise<NotificationRecipient[]> {
  const [assignments, client] = await Promise.all([
    db.clientAssignment.findMany({
      where: { clientId, organizationUser: { status: 'ACTIVE', user: { status: 'ACTIVE' } } },
      include: { organizationUser: { include: { user: true } } },
    }),
    db.client.findUnique({
      where: { id: clientId },
      select: { accountManager: { include: { user: true } } },
    }),
  ])

  const recipients = assignments.map((a) => ({
    userId: a.organizationUser.userId,
    email: a.organizationUser.user.email,
    name: a.organizationUser.user.name,
  }))

  if (client?.accountManager && client.accountManager.status === 'ACTIVE' && client.accountManager.user.status === 'ACTIVE') {
    recipients.push({
      userId: client.accountManager.userId,
      email: client.accountManager.user.email,
      name: client.accountManager.user.name,
    })
  }

  return dedupe(recipients)
}

/**
 * Every ACTIVE super_admin in the organization - the escalation floor for
 * anything that must never be silently buried (BRD Section 106), regardless
 * of whether a client even has assigned staff yet.
 */
export async function resolveOrgAdminRecipients(organizationId: string): Promise<NotificationRecipient[]> {
  const admins = await db.organizationUser.findMany({
    where: { organizationId, status: 'ACTIVE', user: { status: 'ACTIVE' }, role: { key: 'super_admin' } },
    include: { user: true },
  })
  return dedupe(admins.map((a) => ({ userId: a.userId, email: a.user.email, name: a.user.name })))
}

/** `resolveClientStaffRecipients` + `resolveOrgAdminRecipients`, deduped - the usual "everyone who should know" set for a client-scoped event that also warrants escalation. */
export async function resolveClientAndAdminRecipients(
  organizationId: string,
  clientId: string,
): Promise<NotificationRecipient[]> {
  const [staff, admins] = await Promise.all([resolveClientStaffRecipients(clientId), resolveOrgAdminRecipients(organizationId)])
  return dedupe([...staff, ...admins])
}
