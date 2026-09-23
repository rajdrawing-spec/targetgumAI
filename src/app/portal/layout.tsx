import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, LogOut } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * The Client Portal (BRD-PRD Section 4.4, Phase 2's "Client approval
 * portal" - `docs/BRD-PRD.md` Section 85). A `client`'s capability
 * list is deliberately narrower than staff's `/dashboard`: View own
 * dashboard, View reports, Review recommendations, Approve allowed
 * actions, Provide feedback, View content/creative, Never access another
 * client. No Tasks/Approvals(Engine)/AI Runs/Integrations/Audit here -
 * those are internal-only (Section 4.1-4.3) and would leak internal
 * operational detail (cost, technical reasoning) a client was never meant
 * to see.
 *
 * Staff never land here - `/dashboard/layout.tsx` is the mirror image,
 * redirecting a `client` to `/portal` instead.
 *
 * Deliberately no role-switcher here (removed 2026-09-13, docs/DECISIONS.md)
 * - see `/dashboard/layout.tsx`'s doc comment for why.
 */

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  if (!ctx.isClientUser) redirect('/dashboard')

  return (
    <ToastProvider>
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/portal" className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground shadow-glow">
                <Sparkles className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-foreground block">TargetGum</span>
                <span className="text-[10px] font-medium text-caption uppercase tracking-wider block">Client Portal</span>
              </div>
            </Link>
            <span className="ml-2 hidden items-center gap-1 rounded-full bg-success-bg text-success border border-success/20 px-2.5 py-0.5 text-xs font-semibold sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Client Workspace
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/sign-in' })
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
    </ToastProvider>
  )
}
