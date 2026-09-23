import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'
import { countUnreadNotifications, listNotificationsForUser } from '@/lib/notifications/service'
import { TopNav, MobileMenu } from '@/components/dashboard-nav'
import { AccountMenu } from '@/components/account-menu'
import { NotificationBell } from '@/components/notification-bell'
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
 * Layout shape (2026-09-23, docs/DECISIONS.md - replaces the 2026-09-13
 * sidebar+content shape): a single full-width top bar is the *only* nav
 * surface now - logo, `TopNav` (Command Center / Clients direct links,
 * Campaigns / Insights dropdowns), search, the AI Engine badge,
 * notifications, theme toggle, and `AccountMenu` (Team / Integrations /
 * My Account / Sign out - moved out of a sidebar footer into an avatar
 * menu, the standard home for account-scoped pages once there's no
 * sidebar to anchor them to). Below `lg`, `TopNav` hides and `MobileMenu`
 * (a hamburger opening the same grouped nav data as a dropdown panel)
 * takes over - no more off-canvas drawer or collapsible-sidebar
 * checkboxes; the main content area is simply full-width at every size.
 */
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  employee: 'Employee',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  if (ctx.isClientUser) redirect('/portal')

  const [unreadCount, recentNotifications] = await Promise.all([
    countUnreadNotifications(ctx),
    listNotificationsForUser(ctx, { limit: 8 }),
  ])

  const roleLabel = ROLE_LABEL[ctx.roleKey] ?? ctx.roleKey
  const orgLabel = ctx.organizationId ? `Org: ${ctx.organizationId.slice(0, 8)}...` : 'System Mode'

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-md sm:px-6">
          <MobileMenu search={<UniversalSearch />} />

          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-background transition-colors group-hover:border-primary">
              <Image src="/logo.jpg" alt="TargetGum" width={32} height={32} className="object-contain" priority />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-1 font-display text-base font-extrabold leading-tight tracking-tight text-foreground">
                Target<span className="text-primary">Gum</span>
              </div>
              <span className="block truncate text-[9px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
                Precision Marketing
              </span>
            </div>
          </Link>

          <TopNav />

          <div className="hidden items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-[11px] font-bold text-primary 2xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>AI Engine Online</span>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center px-2 xl:flex">
            <UniversalSearch className="max-w-sm" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <NotificationBell unreadCount={unreadCount} items={recentNotifications} />
            <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
            <AccountMenu roleLabel={roleLabel} orgLabel={orgLabel} signOutAction={signOutAction} />
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
