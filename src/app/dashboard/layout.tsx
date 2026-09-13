import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard-nav'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeToggle } from '@/components/theme-toggle'
import { UniversalSearch } from '@/components/universal-search'

/**
 * The dashboard shell (BRD-PRD Section 42). This layout is staff-only. A
 * `client` gets a distinct, narrower experience at `/portal` (BRD Section
 * 4.4 - "View own dashboard" reads as *their own*, not the internal one) -
 * see `src/app/portal/`.
 *
 * Deliberately no role-switcher here (removed 2026-09-13, docs/DECISIONS.md):
 * the one that briefly existed re-signed-in as one of three hardcoded
 * seeded accounts using their known dev password, one click, for *any*
 * already-authenticated user regardless of their real role - a live
 * privilege-escalation hole once real accounts exist via the invitation
 * system (`src/lib/users/invitations.ts`). Switching who you're signed in
 * as now means signing out and back in as that account, same as any real
 * user.
 *
 * Colors go through the light/dark CSS variables in src/app/globals.css
 * (`var(--bg-ink)` etc, toggled by ThemeToggle flipping a `dark` class on
 * <html>) rather than the literal hex this file used before - same visual
 * design, now theme-aware. The mobile nav drawer below is a pure-CSS
 * checkbox toggle (`peer-checked:`) - no client component needed for it.
 */
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  employee: 'Employee',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  if (ctx.isClientUser) redirect('/portal')

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--bg-ink)] text-[var(--text-primary-hex)]">
        {/* Mobile nav drawer toggle - a hidden checkbox driving peer-checked: below, no JS needed. */}
        <input type="checkbox" id="mobile-nav-toggle" className="peer hidden" />

        {/* Left Precision Sidebar - off-canvas drawer below lg, static column at lg+ */}
        <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] -translate-x-full flex-col border-r border-[var(--border-hairline)] bg-[var(--surface-base)] transition-transform duration-200 peer-checked:translate-x-0 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0">
          {/* Brand Header with TargetGum Logo */}
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4">
            <Link href="/dashboard" className="group flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-hairline)] bg-[var(--bg-ink)] shadow-sm transition-colors group-hover:border-[#E5252A]">
                <Image
                  src="/logo.jpg"
                  alt="TargetGum"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-display text-base font-bold tracking-tight text-[var(--text-primary-hex)]">
                  Target<span className="text-[#E5252A]">Gum</span>
                </div>
                <span className="block truncate text-[10px] font-mono-data font-semibold uppercase tracking-wider text-[var(--text-muted-hex)]">
                  Precision Marketing
                </span>
              </div>
            </Link>
            <label
              htmlFor="mobile-nav-toggle"
              aria-label="Close menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--text-faint-hex)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </label>
          </div>

          {/* Nav List */}
          <div className="flex-1 overflow-y-auto">
            <DashboardNav />
          </div>

          {/* User & Org Session Footer */}
          <div className="mt-auto border-t border-[var(--border-hairline)] bg-[var(--surface-footer)] p-3">
            <div className="flex items-center justify-between gap-2 rounded border border-[var(--border-hairline)] bg-[var(--surface-base)] px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[var(--text-primary-hex)]">
                  {ROLE_LABEL[ctx.roleKey] ?? ctx.roleKey}
                </p>
                <p className="truncate text-[11px] font-mono-data text-[var(--text-muted-hex)]">
                  {ctx.organizationId ? `Org: ${ctx.organizationId.slice(0, 8)}...` : 'System Mode'}
                </p>
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
                  className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-faint-hex)] transition-colors hover:bg-[#E5252A]/15 hover:text-[var(--danger-text-hex)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* Backdrop - mobile only, closes the drawer on click via the same checkbox. */}
        <label
          htmlFor="mobile-nav-toggle"
          aria-hidden
          className="fixed inset-0 z-40 hidden bg-black/50 peer-checked:block lg:hidden"
        />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-hairline)] bg-[var(--surface-base)]/85 px-4 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <label
                htmlFor="mobile-nav-toggle"
                aria-label="Open menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--text-faint-hex)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)] lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </label>
              <Link
                href="/dashboard"
                className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary-hex)] transition-colors hover:text-[#E5252A]"
              >
                TargetGum Agency Terminal
              </Link>
              <div className="hidden items-center gap-1.5 rounded-full border border-[#E5252A]/30 bg-[#E5252A]/10 px-2.5 py-0.5 text-[11px] font-mono-data font-medium text-[var(--danger-text-hex)] xl:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E5252A] animate-pulse" />
                <span>AI ENGINE ONLINE</span>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
              <UniversalSearch className="max-w-md" />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              <span className="hidden text-xs font-mono-data uppercase tracking-wider text-[var(--text-faint-hex)] sm:inline">
                {ROLE_LABEL[ctx.roleKey] ?? ctx.roleKey}
              </span>
              <ThemeToggle className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-faint-hex)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)]" />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[var(--bg-ink)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
