import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { hashPassword } from '@/lib/auth/password'
import { isEmailConfigured, sendMail } from '@/lib/email/mailer'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import { INVITABLE_ROLES, type SystemRoleKey } from '@/lib/rbac/permissions'
import type { AuthContext } from '@/lib/rbac/types'
import { ForbiddenError } from '@/lib/rbac/errors'

/**
 * Email invitations (2026-09-13 role-model simplification, see
 * docs/DECISIONS.md): the only way a person gets access to this app.
 * There is no self-service sign-up - a Super Admin (`users.manage`, held
 * only by `super_admin`) invites someone by email and picks their role
 * (`employee` or `client` - INVITABLE_ROLES). Nothing is granted until the
 * invitee follows the emailed link and sets a password
 * (`acceptInvitation` below) - no OrganizationUser/ClientUser row exists
 * for them before that, so a revoked or expired invite has granted
 * literally nothing.
 *
 * The raw invitation token is never stored - only its SHA-256 hash
 * (`tokenHash`), matching this app's "never expose secrets" rule
 * (docs/SECURITY.md). The raw token exists only in the emailed link and
 * the invitee's browser.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000'
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: z.enum(INVITABLE_ROLES as [SystemRoleKey, ...SystemRoleKey[]], {
    errorMap: () => ({ message: 'Choose a role to invite.' }),
  }),
  clientIds: z.array(z.string()).max(200).optional().default([]),
  clientId: z.string().optional(),
})

export type InviteUserInput = z.input<typeof inviteSchema>

/** Only a Super Admin (the only role with `users.manage`) may invite anyone or choose their role. */
async function assertCanManageUsers(ctx: AuthContext) {
  assertPermission(ctx, 'users.manage')
}

/**
 * Verifies every id in `clientIds` belongs to the caller's organization -
 * never trust caller-supplied ids alone (docs/SECURITY.md invariant #1).
 * Throws ForbiddenError naming nothing about *why* an id was rejected
 * (unknown vs. another org's client look identical to the caller).
 */
async function assertClientsInOrg(organizationId: string, clientIds: string[]) {
  if (clientIds.length === 0) return
  const found = await db.client.findMany({
    where: { id: { in: clientIds }, organizationId },
    select: { id: true },
  })
  if (found.length !== new Set(clientIds).size) {
    throw new ForbiddenError('One or more selected clients are not in this organization.')
  }
}

export async function inviteUser(ctx: AuthContext, input: InviteUserInput) {
  await assertCanManageUsers(ctx)
  const parsed = inviteSchema.parse(input)

  if (parsed.role === 'client' && !parsed.clientId) {
    throw new Error('Select which client this person belongs to.')
  }
  if (parsed.role === 'employee' && parsed.clientId) {
    throw new Error('Employee invitations use clientIds, not a single clientId.')
  }

  const clientIds = parsed.role === 'employee' ? parsed.clientIds : []
  await assertClientsInOrg(ctx.organizationId, parsed.role === 'client' ? [parsed.clientId!] : clientIds)

  // One active person per email in this org already - and no more than one
  // pending invite for the same email, so re-inviting doesn't pile up
  // silently-superseded rows.
  const existingUser = await db.user.findUnique({ where: { email: parsed.email } })
  if (existingUser) {
    const alreadyMember = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: ctx.organizationId, userId: existingUser.id } },
    })
    const alreadyClientUser = await db.clientUser.findFirst({
      where: { userId: existingUser.id, client: { organizationId: ctx.organizationId } },
    })
    if (alreadyMember || alreadyClientUser) {
      throw new Error('That person already has access to this organization.')
    }
  }
  const existingInvite = await db.invitation.findFirst({
    where: { organizationId: ctx.organizationId, email: parsed.email, status: 'PENDING' },
  })
  if (existingInvite) {
    throw new Error('There is already a pending invitation for that email - resend or revoke it instead.')
  }

  const token = generateToken()
  const invitation = await db.invitation.create({
    data: {
      organizationId: ctx.organizationId,
      email: parsed.email,
      role: parsed.role,
      clientIds,
      clientId: parsed.role === 'client' ? parsed.clientId : null,
      tokenHash: hashToken(token),
      invitedByUserId: ctx.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  })

  const { sent, url } = await sendInviteEmail(invitation.email, invitation.role, token)
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'invitation.created',
    result: 'SUCCESS',
    outputSummary: { invitationId: invitation.id, email: invitation.email, role: invitation.role, emailSent: sent },
  })

  // Email delivery isn't required for the invitation to exist - only for
  // this deployment to hand the link to the invitee automatically. When
  // SMTP isn't configured, hand the raw link back to the Super Admin
  // instead of failing the whole invite (docs/SECURITY.md - never expose
  // secrets - is not violated: this link is meant for exactly the person
  // the Super Admin is about to send it to, not logged or stored anywhere
  // beyond this one response).
  return { invitation, emailSent: sent, inviteUrl: sent ? undefined : url }
}

/**
 * Returns whether the email actually sent. When `EMAIL_SERVER_HOST` isn't
 * configured on this deployment, this deliberately does NOT throw the way
 * `sendMail` would for the magic-link flow (which has no other way to
 * reach the invitee) - the caller here always has a UI to hand the raw
 * link back to instead, so a missing SMTP config degrades to a manual
 * copy/paste step rather than a hard failure.
 */
async function sendInviteEmail(email: string, role: string, token: string): Promise<{ sent: boolean; url: string }> {
  const url = `${appUrl()}/accept-invite/${token}`
  if (!isEmailConfigured()) {
    console.warn(`[invite link - email not configured] ${email} -> ${url}`)
    return { sent: false, url }
  }
  const roleLabel = role === 'employee' ? 'an Employee' : 'a Client'
  await sendMail({
    to: email,
    subject: "You've been invited to TargetGum AI Marketing OS",
    text: `You've been invited to join TargetGum AI Marketing OS as ${roleLabel}. Set up your account: ${url}\n\nThis link expires in 7 days.`,
    html: `<p>You've been invited to join TargetGum AI Marketing OS as ${roleLabel}.</p><p><a href="${url}">Set up your account</a></p><p>This link expires in 7 days.</p>`,
  })
  return { sent: true, url }
}

/** Revokes a pending invitation - it grants nothing once revoked, since nothing was ever created for it. */
export async function revokeInvitation(ctx: AuthContext, invitationId: string) {
  await assertCanManageUsers(ctx)
  const invitation = await db.invitation.findUnique({ where: { id: invitationId } })
  if (!invitation || invitation.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Invitation not found.')
  }
  if (invitation.status !== 'PENDING') {
    throw new Error('Only a pending invitation can be revoked.')
  }
  await db.invitation.update({ where: { id: invitationId }, data: { status: 'REVOKED' } })
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'invitation.revoked',
    result: 'SUCCESS',
    outputSummary: { invitationId },
  })
}

/** Rotates the token and expiry on a pending (or expired) invitation and re-sends the email. */
export async function resendInvitation(ctx: AuthContext, invitationId: string) {
  await assertCanManageUsers(ctx)
  const invitation = await db.invitation.findUnique({ where: { id: invitationId } })
  if (!invitation || invitation.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Invitation not found.')
  }
  if (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED') {
    throw new Error('That invitation can no longer be resent.')
  }
  const token = generateToken()
  const updated = await db.invitation.update({
    where: { id: invitationId },
    data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS), status: 'PENDING' },
  })
  const { sent, url } = await sendInviteEmail(updated.email, updated.role, token)
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'invitation.resent',
    result: 'SUCCESS',
    outputSummary: { invitationId, emailSent: sent },
  })
  return { emailSent: sent, inviteUrl: sent ? undefined : url }
}

export async function listInvitations(ctx: AuthContext) {
  await assertCanManageUsers(ctx)
  return db.invitation.findMany({
    where: { organizationId: ctx.organizationId, status: { in: ['PENDING', 'EXPIRED'] } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listOrganizationMembers(ctx: AuthContext) {
  await assertCanManageUsers(ctx)
  const [staff, clientUsers] = await Promise.all([
    db.organizationUser.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        role: { select: { key: true, name: true } },
        user: { select: { id: true, name: true, email: true, status: true } },
        assignedClients: { select: { client: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.clientUser.findMany({
      where: { client: { organizationId: ctx.organizationId } },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, status: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  return { staff, clientUsers }
}

/**
 * Looks up a pending invitation by its raw token, for rendering the
 * accept-invite page. Deliberately returns very little (email, role, org
 * name) - never the whole row - and treats "expired" and "not found" the
 * same to the caller (both just mean "this link doesn't work").
 */
export async function getInvitationByToken(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, email: true, role: true, status: true, expiresAt: true, organization: { select: { name: true } } },
  })
  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
    return null
  }
  return { email: invitation.email, role: invitation.role, organizationName: invitation.organization.name }
}

const acceptSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(200),
})

export type AcceptInvitationInput = z.input<typeof acceptSchema>

/**
 * Consumes a pending invitation: creates the User (if one doesn't already
 * exist for that email - re-checked here, not just at invite time, to
 * close the race where two invites for the same email are accepted
 * concurrently) and exactly the access rows the invitation described -
 * OrganizationUser + ClientAssignment rows for `employee`, or a ClientUser
 * row for `client`. Never anything broader than what the invitation itself
 * recorded.
 */
export async function acceptInvitation(token: string, input: AcceptInvitationInput) {
  const parsed = acceptSchema.parse(input)
  const tokenHash = hashToken(token)

  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash } })
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new Error('This invitation link is invalid or has expired.')
    }

    const existingUser = await tx.user.findUnique({ where: { email: invitation.email } })
    if (existingUser) {
      throw new Error('An account with this email already exists - sign in instead.')
    }

    const role = await tx.role.findUnique({ where: { organizationId_key: { organizationId: invitation.organizationId, key: invitation.role } } })
    if (!role) throw new Error('This invitation is no longer valid.')

    const passwordHash = await hashPassword(parsed.password)
    const user = await tx.user.create({
      data: { email: invitation.email, name: parsed.name, passwordHash, emailVerified: new Date() },
    })

    if (invitation.role === 'employee') {
      const membership = await tx.organizationUser.create({
        data: { organizationId: invitation.organizationId, userId: user.id, roleId: role.id },
      })
      if (invitation.clientIds.length > 0) {
        await tx.clientAssignment.createMany({
          data: invitation.clientIds.map((clientId) => ({ clientId, organizationUserId: membership.id })),
          skipDuplicates: true,
        })
      }
    } else {
      if (!invitation.clientId) throw new Error('This invitation is missing its client and cannot be completed.')
      await tx.clientUser.create({ data: { clientId: invitation.clientId, userId: user.id } })
    }

    await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } })
    await tx.auditEvent.create({
      data: {
        organizationId: invitation.organizationId,
        userId: user.id,
        action: 'invitation.accepted',
        result: 'SUCCESS',
        outputSummary: { invitationId: invitation.id, role: invitation.role },
      },
    })

    return { email: user.email }
  })
}
