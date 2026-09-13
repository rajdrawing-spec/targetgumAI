'use server'

import { acceptInvitation } from '@/lib/users/invitations'
import { actionError, actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Public Server Action - no auth context, since the whole point of an
 * invitation is that the invitee has no account yet. `acceptInvitation`
 * (src/lib/users/invitations.ts) does its own validation (token, expiry,
 * password strength) inside a transaction.
 */
export async function acceptInvitationAction(token: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('acceptInvitation', async () => {
    const name = formString(formData, 'name') ?? ''
    const password = formString(formData, 'password') ?? ''
    const confirmPassword = formString(formData, 'confirmPassword') ?? ''
    if (password !== confirmPassword) {
      return actionError('Passwords do not match.', { confirmPassword: 'Passwords do not match.' })
    }

    await acceptInvitation(token, { name, password })
    return actionOk('Account created - sign in to continue.', { redirectTo: '/sign-in' })
  })
}
