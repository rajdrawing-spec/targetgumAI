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
 * design, now theme-aware.
 *
 * Layout shape (2026-09-13): one full-width top bar (logo/name, the
 * hamburger, search, role, theme) sits above a row of [sidebar, main
 * content] - not a sidebar with its own separate brand header. The
 * hamburger is two pure-CSS checkbox toggles, no client JS:
 * `mobile-nav-toggle` (below `lg` - an off-canvas drawer under the top
 * bar, which is why the drawer/backdrop start at `top-16` instead of the
 * viewport top - the top bar, and its hamburger, must stay reachable to
 * close it again) and `sidebar-collapse-toggle` (`lg`+ - collapses the
 * static column to width 0 and back, `defaultChecked` so it starts open).
 * Two separate `<label>`s bound to the two checkboxes occupy the same
 * header slot and are shown/hidden by breakpoint, so one hamburger *looks*
 * like a single control while actually driving whichever toggle applies.
 * The sidebar's inner content keeps a fixed width during the collapse
 * transition (only the outer `<aside>` animates width+opacity) so nav
 * labels don't wrap/reflow mid-animation.
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
      <div className="flex min-h-screen flex-col bg-[var(--bg-ink)] text-[var(--text-primary-hex)]">
        {/* Unified top bar - full width, always visible, sits above the sidebar+content row. */}
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-hairline)] bg-[var(--surface-base)]/95 px-4 backdrop-blur-md sm:px-6">
          <label
            htmlFor="mobile-nav-toggle"
            aria-label="Toggle menu"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-faint-hex)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)] lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </label>
          <label
            htmlFor="sidebar-collapse-toggle"
            aria-label="Toggle sidebar"
            className="hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-faint-hex)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)] lg:flex"
          >
            <Menu className="h-4 w-4" />
          </label>

          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-hairline)] bg-[var(--bg-ink)] shadow-sm transition-colors group-hover:border-[#E5252A]">
              <Image src="/logo.jpg" alt="TargetGum" width={32} height={32} className="object-contain" priority />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-1 font-display text-sm font-bold leading-tight tracking-tight text-[var(--text-primary-hex)]">
                Target<span className="text-[#E5252A]">Gum</span>
              </div>
              <span className="block truncate text-[9px] font-mono-data font-semibold uppercase leading-tight tracking-wider text-[var(--text-muted-hex)]">
                Precision Marketing
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-1.5 rounded-full border border-[#E5252A]/30 bg-[#E5252A]/10 px-2.5 py-0.5 text-[11px] font-mono-data font-medium text-[var(--danger-text-hex)] xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E5252A] animate-pulse" />
            <span>AI ENGINE ONLINE</span>
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

        {/* Sidebar + main content, below the top bar */}
        <div className="flex min-h-0 flex-1">
          {/* Hidden checkboxes driving the two hamburger behaviors above via peer-checked: - no JS needed.
              Positioned here, as immediate siblings of <aside>, since peer-checked: only matches through
              the CSS general-sibling combinator (same parent), not descendants of a later sibling. The
              <label>s in the header above still bind to these by htmlFor from anywhere in the DOM. */}
          <input type="checkbox" id="mobile-nav-toggle" className="peer hidden" />
          <input type="checkbox" id="sidebar-collapse-toggle" defaultChecked className="peer/collapse hidden" />

          {/* Left Precision Sidebar - off-canvas drawer below lg (top-16 so the bar above stays reachable to close it), a
              width/opacity-collapsible static column at lg+ (peer-checked/collapse:, starts expanded via defaultChecked). */}
          <aside className="fixed left-0 top-16 bottom-0 z-40 flex w-72 max-w-[85vw] -translate-x-full flex-col border-r border-[var(--border-hairline)] bg-[var(--surface-base)] transition-transform duration-200 ease-in-out peer-checked:translate-x-0 lg:static lg:top-auto lg:bottom-auto lg:z-auto lg:max-w-none lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-r-0 lg:opacity-0 lg:transition-[width,opacity] lg:duration-300 lg:ease-in-out peer-checked/collapse:lg:w-64 peer-checked/collapse:lg:border-r peer-checked/collapse:lg:opacity-100">
            {/* Fixed-size inner content - only the <aside> above animates width, so nav labels never wrap/reflow mid-transition. */}
            <div className="flex h-full w-72 max-w-[85vw] flex-col lg:w-64">
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
            </div>
          </aside>

          {/* Backdrop - mobile only, closes the drawer on click via the same checkbox. Starts at top-16 so the top bar (and its hamburger) stays visible/clickable above it. */}
          <label
            htmlFor="mobile-nav-toggle"
            aria-hidden
            className="fixed inset-x-0 top-16 bottom-0 z-30 hidden bg-black/50 peer-checked:block lg:hidden"
          />

          <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--bg-ink)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
