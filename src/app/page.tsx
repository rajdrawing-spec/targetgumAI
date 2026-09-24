import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { Landing } from '@/components/tryit/landing'

/**
 * Root route: a signed-in visitor goes straight to the surface they belong
 * in (unchanged); everyone else gets the public landing page and its
 * "Start free" try-it instead of a login wall (docs/DECISIONS.md
 * 2026-09-24). Access to any real data still requires an invited account.
 */
export default async function HomePage() {
  const ctx = await getCurrentAuthContext()
  if (ctx) redirect(ctx.isClientUser ? '/portal' : '/dashboard')
  return <Landing />
}
