'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { changeOwnPassword, updateOwnName } from '@/lib/users/profile'
import { AuthenticationError } from '@/lib/rbac/errors'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions for the "My Account" page (src/app/dashboard/account/
 * page.tsx) - a user editing their own name and password. Same convention
 * as src/app/dashboard/team/actions.ts: resolve ctx, parse the form, call
 * the already permission-scoped lib function, return an ActionResult.
 * Neither action takes a target user id - src/lib/users/profile.ts only
 * ever touches `ctx.userId`, so there is nothing here for a permission
 * check to gate.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

function revalidateAccount() {
  revalidatePath('/dashboard/account')
}

export async function updateOwnProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('updateOwnProfile', async () => {
    const ctx = await requireCtx()
    const name = formString(formData, 'name') ?? ''
    await updateOwnName(ctx, { name })
    revalidateAccount()
    return actionOk('Profile updated.')
  })
}

export async function changeOwnPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('changeOwnPassword', async () => {
    const ctx = await requireCtx()
    const currentPassword = formString(formData, 'currentPassword')
    const newPassword = formString(formData, 'newPassword') ?? ''
    await changeOwnPassword(ctx, { currentPassword, newPassword })
    revalidateAccount()
    return actionOk('Password updated.')
  })
}
