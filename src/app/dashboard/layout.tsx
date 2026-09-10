import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'

/**
 * The Day 13/14 dashboard shell (BRD-PRD Section 42). Nav mirrors the
 * subset of the BRD's full nav list that's actually implemented in the
 * MVP - Overview, Clients, Recommendations, Tasks, Approvals, AI Runs,
 * Reports, Integrations, Audit. Social, Advertising, Analytics, SEO,
 * Content Calendar, Creatives, Settings are BRD Section 42's fuller nav,
 * out of MVP scope per Section 45/49 (see docs/MVP-CHECKLIST.md) - added
 * when their underlying modules exist. Audit is shown to everyone in the
 * nav even though only super_admin holds `audit.read` by default
 * (Section 4.1) - visiting it as anyone else hits the Day 14 error
 * boundary's clean permission-denied message rather than a dead end.
 */

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/recommendations', label: 'Recommendations' },
  { href: '/dashboard/tasks', label: 'Tasks' },
  { href: '/dashboard/approvals', label: 'Approvals' },
  { href: '/dashboard/ai-runs', label: 'AI Runs' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/audit', label: 'Audit' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold">TargetGum</span>
            <nav className="flex gap-5 text-sm text-gray-600">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-gray-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{ctx.roleKey}</span>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/sign-in' })
              }}
            >
              <button type="submit" className="hover:text-gray-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
