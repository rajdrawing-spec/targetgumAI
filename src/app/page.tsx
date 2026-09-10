import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'

/** Root route: send a signed-in visitor straight to the surface they belong in, everyone else to sign-in. */
export default async function HomePage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  redirect(ctx.isClientUser ? '/portal' : '/dashboard')
}
