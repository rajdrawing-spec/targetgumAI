import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, LogOut } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/toast'

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
    <ToastProvider>
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium tracking-tight">TargetGum</span>
          </Link>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/sign-in' })
            }}
          >
            <button type="submit" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
    </ToastProvider>
  )
}
