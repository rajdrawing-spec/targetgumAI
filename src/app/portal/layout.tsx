import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'

/**
 * The Client Portal (BRD-PRD Section 4.4, Phase 2's "Client approval
 * portal" - `docs/BRD-PRD.md` Section 85). A `client_user`'s capability
 * list is deliberately narrower than staff's `/dashboard`: View own
 * dashboard, View reports, Review recommendations, Approve allowed
 * actions, Provide feedback, View content/creative, Never access another
 * client. No Tasks/Approvals(Engine)/AI Runs/Integrations/Audit here -
 * those are internal-only (Section 4.1-4.3) and would leak internal
 * operational detail (cost, technical reasoning) a client was never meant
 * to see.
 *
 * Staff never land here - `/dashboard/layout.tsx` is the mirror image,
 * redirecting a `client_user` to `/portal` instead.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  if (!ctx.isClientUser) redirect('/dashboard')

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/portal" className="text-sm font-semibold">
            TargetGum
          </Link>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/sign-in' })
            }}
          >
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  )
}
