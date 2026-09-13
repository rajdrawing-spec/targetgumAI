import { z } from 'zod'
import { db } from '@/lib/db/client'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { recordAuditEvent } from '@/lib/audit/record'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Self-service account management - a signed-in user viewing/editing THEIR
 * OWN details (name) and password. Deliberately requires no RBAC
 * permission: every function here operates exclusively on `ctx.userId`
 * (never a caller-supplied id), so there is no privilege to check beyond
 * "is this a real, authenticated session" - the same "no elevated access
 * needed to act on yourself" shape already used elsewhere (e.g. signing
 * yourself out). Editing your own email is deliberately NOT offered here
 * yet - email doubles as the sign-in/invitation identity key
 * (`User.email` is unique, invitations and Google account linking both key
 * off it), so a self-service email change is a materially bigger feature
 * (re-verification, collision handling) left for later.
 */

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
})

// Same minimum as the invitation-acceptance password schema
// (src/lib/users/invitations.ts) - one password policy, not two.
const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(10, 'New password must be at least 10 characters.').max(200),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password.',
    path: ['newPassword'],
  })

export interface OwnProfile {
  id: string
  name: string | null
  email: string
  image: string | null
  mfaEnabled: boolean
  /** Whether the account can sign in with a password at all - false for a Google-only account that has never set one. */
  hasPassword: boolean
  createdAt: Date
}

/** Reads the caller's own profile - never another user's, by construction (no id parameter). */
export async function getOwnProfile(ctx: AuthContext): Promise<OwnProfile> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { id: true, name: true, email: true, image: true, mfaEnabled: true, passwordHash: true, createdAt: true },
  })
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    mfaEnabled: user.mfaEnabled,
    hasPassword: user.passwordHash !== null,
    createdAt: user.createdAt,
  }
}

/** Updates the caller's own display name. */
export async function updateOwnName(ctx: AuthContext, input: { name: string }): Promise<{ id: string; name: string | null }> {
  const { name } = nameSchema.parse(input)

  const updated = await db.user.update({
    where: { id: ctx.userId },
    data: { name },
    select: { id: true, name: true },
  })

  await recordAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'user.profile.updated',
    result: 'SUCCESS',
  })

  return updated
}

/**
 * Changes (or, for a Google-only account with no password yet, sets) the
 * caller's own password. A current password is required and verified
 * whenever one already exists - never skippable just because the caller
 * is authenticated (docs/SECURITY.md invariant: an authenticated session
 * alone doesn't prove the person still holds the password, e.g. a
 * left-open browser). Only when no password exists yet is there nothing
 * to verify.
 *
 * Note: sessions here are JWT-based (docs/DECISIONS.md - "sessions can't
 * be server-side-revoked by deleting a DB row"), so this does not and
 * cannot invalidate any other active session carrying the old password's
 * era - same accepted trade-off as that decision, not a new one.
 */
export async function changeOwnPassword(
  ctx: AuthContext,
  input: { currentPassword?: string; newPassword: string },
): Promise<void> {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input)

  const user = await db.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { passwordHash: true },
  })

  if (user.passwordHash) {
    if (!currentPassword) {
      throw new Error('Current password is required.')
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      await recordAuditEvent({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'user.password.change_denied',
        result: 'DENIED',
        error: 'Current password did not match.',
      })
      throw new Error('Current password is invalid.')
    }
  }

  const newHash = await hashPassword(newPassword)
  await db.user.update({ where: { id: ctx.userId }, data: { passwordHash: newHash } })

  await recordAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: user.passwordHash ? 'user.password.changed' : 'user.password.set',
    result: 'SUCCESS',
  })
}
