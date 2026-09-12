'use server'

import { signIn } from '@/lib/auth'

const ROLE_EMAILS: Record<string, string> = {
  super_admin: 'super-admin@targetgum.dev',
  marketing_employee: 'employee@targetgum.dev',
  client_user: 'client-a-user@targetgum.dev',
}

export async function switchRoleAction(targetRole: 'super_admin' | 'marketing_employee' | 'client_user') {
  const email = ROLE_EMAILS[targetRole]
  if (!email) throw new Error(`Unknown role: ${targetRole}`)

  await signIn('credentials', {
    email,
    password: 'DevPassword!23',
    redirectTo: targetRole === 'client_user' ? '/portal' : '/dashboard',
  })
}
