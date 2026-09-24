'use client'

import { useEffect, useRef, useState } from 'react'
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
  Lightbulb,
  CheckSquare,
  ShieldCheck,
  Bot,
  FileText,
  ScrollText,
  BarChart3,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Left sidebar nav (docs/DECISIONS.md 2026-09-24 - restores the persistent
 * sidebar, reversing the 2026-09-23 top-nav-only shell per explicit
 * direction to match a reference mockup's layout). `NAV_DIRECT` +
 * `NAV_GROUPS` is the same data the brief top-nav version used - two direct
 * links plus two labeled sections (Campaigns, Insights) - just rendered as
 * one always-visible vertical rail (`SidebarNav`, `lg`+) instead of top
 * dropdowns. Below `lg`, `MobileMenu`'s hamburger + panel is still how
 * navigation works - `SidebarNav` and `MobileNav` share the same
 * `NavList` rendering so the two stay in sync automatically.
 *
 * `NAV_ITEMS` stays exported as a flat list - `universal-search.tsx`
 * indexes it for "jump to page" results and has no reason to know about
 * the grouping.
 */

export type NavLeaf = { href: string; label: string; icon: LucideIcon; badge?: string; isAlert?: boolean }
export type NavGroup = { label: string; icon: LucideIcon; items: NavLeaf[] }

export const NAV_DIRECT: NavLeaf[] = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
]

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Campaigns',
    icon: Megaphone,
    items: [
      { href: '/dashboard/ads', label: 'AI Ad Campaigns', icon: Megaphone, badge: 'STUDIO' },
      { href: '/dashboard/content-calendar', label: 'Social Hub', icon: CalendarDays },
      { href: '/dashboard/creatives', label: 'Creative Studio', icon: ImageIcon },
      { href: '/dashboard/keywords', label: 'Keyword Research', icon: KeyRound, badge: 'AI' },
      { href: '/dashboard/seo', label: 'SEO Intelligence', icon: Search },
    ],
  },
  {
    label: 'Insights',
    icon: BarChart3,
    items: [
      { href: '/dashboard/ads/analytics', label: 'Unified Telemetry', icon: BarChart3, badge: 'LIVE' },
      { href: '/dashboard/reports', label: 'Performance Reports', icon: FileText },
      { href: '/dashboard/recommendations', label: 'Recommendations', icon: Lightbulb },
      { href: '/dashboard/tasks', label: 'Action Items', icon: CheckSquare },
      { href: '/dashboard/approvals', label: 'Approvals Gate', icon: ShieldCheck, isAlert: true },
      { href: '/dashboard/ai-runs', label: 'AI Engine Runs', icon: Bot },
      { href: '/dashboard/audit', label: 'Ledger & Audit', icon: ScrollText },
    ],
  },
]

export const NAV_ITEMS: NavLeaf[] = [...NAV_DIRECT, ...NAV_GROUPS.flatMap((g) => g.items)]

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}

/** A single nav row - shared by the persistent sidebar and the mobile drawer. */
function NavRow({ item, active, onClick }: { item: NavLeaf; active: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-press-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'text-muted-foreground')} strokeWidth={2} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            active
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : item.isAlert
                ? 'bg-destructive-bg text-destructive'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  )
}

/** The nav's full content: two direct links, then two labeled sections. Shared by `SidebarNav` (persistent, `lg`+) and `MobileNav` (inside the hamburger's drawer, below `lg`) so the two never drift apart. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {NAV_DIRECT.map((item) => (
          <NavRow key={item.href} item={item} active={isActive(pathname, item.href)} onClick={onNavigate} />
        ))}
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          {group.items.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(pathname, item.href)} onClick={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Persistent left sidebar - visible at `lg`+, where `MobileMenu`'s drawer hides. */
export function SidebarNav() {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      <NavList />
    </nav>
  )
}

/** Mobile nav - the same list, rendered inside the hamburger's dropdown panel. */
export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-2">
      <NavList onNavigate={onNavigate} />
    </div>
  )
}

/** Hamburger button + dropdown panel wrapping `MobileNav`, `lg:hidden`. Closes on navigation, outside click, or Escape. `search` renders above the nav - the header's own search bar hides below `xl` for space, so this is where it lives on smaller screens. */
export function MobileMenu({ search }: { search?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Toggle menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
      </button>

      <div
        className={cn(
          'fixed inset-x-3 top-[4.25rem] z-50 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl border-2 border-border bg-card p-2 shadow-popover transition-all duration-150 sm:inset-x-auto sm:left-3 sm:w-72',
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
        )}
      >
        {search && <div className="border-b border-border p-2 xl:hidden">{search}</div>}
        <MobileNav onNavigate={() => setOpen(false)} />
      </div>
    </div>
  )
}
