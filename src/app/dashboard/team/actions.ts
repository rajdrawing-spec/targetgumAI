'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { inviteUser, resendInvitation, revokeInvitation } from '@/lib/users/invitations'
import { AuthenticationError } from '@/lib/rbac/errors'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions for the Team page (invite / resend / revoke). Same
 * convention as `src/app/dashboard/clients/actions.ts`: resolve ctx, parse
 * the form, call the permission-checked lib function, return an
 * ActionResult. `users.manage` (Super Admin only) is enforced inside
 * `inviteUser`/`resendInvitation`/`revokeInvitation` themselves, not here.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

function revalidateTeam() {
  revalidatePath('/dashboard/team')
}

export async function inviteUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('inviteUser', async () => {
    const ctx = await requireCtx()
    const role = formString(formData, 'role')
    const email = formString(formData, 'email') ?? ''
    const clientId = formString(formData, 'clientId')
    const clientIds = formData.getAll('clientIds').map((v) => String(v))

    const { emailSent, inviteUrl } = await inviteUser(ctx, {
      email,
      role: role as 'employee' | 'client',
      clientId,
      clientIds,
    })
    revalidateTeam()
    return actionOk(
      emailSent ? 'Invitation sent.' : 'Invitation created - email delivery is not configured on this deployment, copy the link below to send it yourself.',
      inviteUrl ? { data: { inviteUrl } } : {},
    )
  })
}

export async function resendInvitationAction(invitationId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('resendInvitation', async () => {
    const ctx = await requireCtx()
    const { emailSent, inviteUrl } = await resendInvitation(ctx, invitationId)
    revalidateTeam()
    return actionOk(
      emailSent ? 'Invitation re-sent.' : 'Invitation refreshed - email delivery is not configured on this deployment, copy the link below to send it yourself.',
      inviteUrl ? { data: { inviteUrl } } : {},
    )
  })
}

export async function revokeInvitationAction(invitationId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('revokeInvitation', async () => {
    const ctx = await requireCtx()
    await revokeInvitation(ctx, invitationId)
    revalidateTeam()
    return actionOk('Invitation revoked.')
  })
}
