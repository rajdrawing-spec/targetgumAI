import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, LogOut } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard-nav'
import { ToastProvider } from '@/components/ui/toast'

/**
 * The Day 13/14 dashboard shell (BRD-PRD Section 42). Nav mirrors the
 * subset of the BRD's full nav list that's actually implemented - Overview,
 * Clients, Recommendations, Tasks, Content calendar, Creatives, SEO,
 * Approvals, AI Runs, Reports, Integrations, Audit. Social, Advertising,
 * Analytics, Settings are BRD Section 42's fuller nav, out of scope per
 * Section 45/49 (see docs/MVP-CHECKLIST.md) - added when their underlying
 * modules exist, same as Content Calendar/Creatives/SEO were. Audit is
 * shown to everyone in the
 * nav even though only super_admin holds `audit.read` by default
 * (Section 4.1) - visiting it as anyone else hits the Day 14 error
 * boundary's clean permission-denied message rather than a dead end.
 *
 * This layout is staff-only. A `client_user` gets a distinct, narrower
 * experience at `/portal` (BRD Section 4.4 - "View own dashboard" reads as
 * *their own*, not the internal one) - see `src/app/portal/`.
 */

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  account_manager: 'Account Manager',
  marketing_employee: 'Marketing Employee',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  if (ctx.isClientUser) redirect('/portal')

  return (
    <ToastProvider>
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium tracking-tight">TargetGum</span>
        </div>
        <DashboardNav />
        <div className="mt-auto border-t border-border p-3">
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{ROLE_LABEL[ctx.roleKey] ?? ctx.roleKey}</p>
              <p className="truncate text-xs text-caption">Signed in</p>
            </div>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/sign-in' })
              }}
            >
              <button
                type="submit"
                title="Sign out"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-6">
          <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            TargetGum Agency Workspace
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </ToastProvider>
  )
}
