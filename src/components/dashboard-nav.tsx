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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const NAV_ITEMS: Array<{ href: string; label: string; icon: LucideIcon; badge?: string; isAlert?: boolean }> = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
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
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
      <div className="px-3 py-1.5 text-[11px] font-mono-data font-semibold uppercase tracking-wider text-[var(--text-muted-hex)]">
        Core Operations
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMobileDrawer}
            className={cn(
              'group flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium transition-all duration-150 relative',
              active
                ? 'bg-[var(--surface-subtle)] text-[var(--text-primary-hex)] font-semibold shadow-sm border-l-2 border-[#E5252A]'
                : 'text-[var(--text-secondary-hex)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)]',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-[#E5252A]' : 'text-[var(--text-dim-hex)] group-hover:text-[var(--text-primary-hex)]'
              )}
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span className="flex-1 truncate tracking-normal">{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-mono-data font-bold uppercase tracking-wider',
                  item.isAlert
                    ? 'bg-[#E5252A]/20 text-[var(--danger-text-hex)] border border-[#E5252A]/40'
                    : 'bg-[var(--surface-badge-neutral)] text-[var(--text-secondary-hex)] border border-[var(--border-badge-neutral)]'
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
