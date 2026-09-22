'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  KeyRound,
  CalendarDays,
  Image as ImageIcon,
  Search,
  UserCog,
  Lightbulb,
  CheckSquare,
  ShieldCheck,
  Bot,
  FileText,
  Plug,
  ScrollText,
  BarChart3,
  Settings,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GummyMascot } from '@/components/growth/mascot'

export const NAV_ITEMS: Array<{ href: string; label: string; icon: LucideIcon; badge?: string; isAlert?: boolean }> = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/clients', label: 'Client Workspaces', icon: Users },
  { href: '/dashboard/ads', label: 'AI Ad Campaigns', icon: Megaphone, badge: 'STUDIO' },
  { href: '/dashboard/ads/analytics', label: 'Unified Telemetry', icon: BarChart3, badge: 'LIVE' },
  { href: '/dashboard/keywords', label: 'Keyword Research', icon: KeyRound, badge: 'AI' },
  { href: '/dashboard/content-calendar', label: 'Social Hub', icon: CalendarDays },
  { href: '/dashboard/creatives', label: 'Creative Studio', icon: ImageIcon },
  { href: '/dashboard/seo', label: 'SEO Intelligence', icon: Search },
  { href: '/dashboard/recommendations', label: 'Recommendations', icon: Lightbulb },
  { href: '/dashboard/tasks', label: 'Action Items', icon: CheckSquare },
  { href: '/dashboard/approvals', label: 'Approvals Gate', icon: ShieldCheck, isAlert: true },
  { href: '/dashboard/ai-runs', label: 'AI Engine Runs', icon: Bot },
  { href: '/dashboard/reports', label: 'Performance Reports', icon: FileText },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  { href: '/dashboard/audit', label: 'Ledger & Audit', icon: ScrollText },
  // Visible to everyone, same as Audit above - users.manage (Super Admin
  // only) is enforced by the page itself via the shared error boundary.
  { href: '/dashboard/team', label: 'Team', icon: UserCog },
  // Self-service only (src/lib/users/profile.ts) - always visible, no
  // permission gate needed since it only ever touches the caller's own row.
  { href: '/dashboard/account', label: 'My Account', icon: Settings },
]

export function DashboardNav() {
  const pathname = usePathname()

  // Mobile drawer (src/app/dashboard/layout.tsx's checkbox toggle) should
  // close after navigating - a plain CSS peer-checkbox has no notion of
  // "route changed," so uncheck it explicitly on click.
  function closeMobileDrawer() {
    const toggle = document.getElementById('mobile-nav-toggle') as HTMLInputElement | null
    if (toggle) toggle.checked = false
  }

  return (
    <div className="flex flex-1 flex-col px-3 py-3">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileDrawer}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150',
                active
                  ? 'bg-[#E5252A] text-white shadow-press-sm'
                  : 'text-[var(--text-secondary-hex)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)]',
              )}
            >
              <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-white' : 'text-[var(--text-dim-hex)] group-hover:text-[var(--text-primary-hex)]')} strokeWidth={2} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    active
                      ? 'bg-white/20 text-white'
                      : item.isAlert
                        ? 'bg-[#E5252A]/15 text-[#E5252A]'
                        : 'bg-[var(--surface-badge-neutral)] text-[var(--text-secondary-hex)]',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mascot promo card, matching the approved Growth Map mockup's sidebar card. */}
      <div className="mt-4 rounded-2xl bg-primary-tint p-4 text-center">
        <GummyMascot className="mx-auto h-14 w-12" />
        <p className="mt-2 text-sm font-bold text-primary">Better Marketing. Bigger Wins.</p>
        <Link
          href="/dashboard/clients"
          className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-press-sm transition-transform active:translate-y-[1px] active:shadow-none"
          aria-label="Go to clients"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
