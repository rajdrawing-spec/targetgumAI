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
  ChevronDown,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Top nav (docs/DECISIONS.md 2026-09-23): replaces the old left sidebar.
 * Every page still needs a way in, so nothing here drops a route - the 18
 * items that used to be one flat sidebar list are now organized as two
 * direct links (the two things used constantly) plus two dropdown groups
 * (Campaigns, Insights), with the three account-scoped pages (Team,
 * Integrations, My Account) moved into the avatar menu in the layout -
 * that's where a person expects account/org-level settings to live, and
 * it keeps the top bar to exactly 4 primary items as asked for.
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

/** A single top-level pill link (Command Center, Clients). */
function NavLink({ item }: { item: NavLeaf }) {
  const pathname = usePathname()
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-press-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
      {item.label}
    </Link>
  )
}

/** A top-level dropdown tab (Campaigns, Insights) - click to open, click outside or Escape to close, fades/scales in. */
function NavDropdown({ group }: { group: NavGroup }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const groupActive = group.items.some((item) => isActive(pathname, item.href))
  const Icon = group.icon

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
          groupActive ? 'bg-primary text-primary-foreground shadow-press-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
        {group.label}
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <div
        className={cn(
          'absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-2xl border-2 border-border bg-card p-1.5 shadow-popover transition-all duration-150',
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
        )}
      >
        {group.items.map((item) => {
          const active = isActive(pathname, item.href)
          const ItemIcon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'bg-primary-tint text-primary' : 'text-foreground hover:bg-muted',
              )}
            >
              <ItemIcon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    item.isAlert ? 'bg-destructive-bg text-destructive' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Desktop top nav - hidden below `lg`, where MobileNav takes over. */
export function TopNav() {
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {NAV_DIRECT.map((item) => (
        <NavLink key={item.href} item={item} />
      ))}
      {NAV_GROUPS.map((group) => (
        <NavDropdown key={group.label} group={group} />
      ))}
    </nav>
  )
}

/** Mobile nav - a full sectioned list inside the hamburger's dropdown panel. */
export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex flex-col gap-1">
        {NAV_DIRECT.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  active ? 'bg-primary-tint text-primary' : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      item.isAlert ? 'bg-destructive-bg text-destructive' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
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
