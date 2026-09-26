'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  Dumbbell,
  Home,
  Map as MapIcon,
  MoreHorizontal,
  Store,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = { href: string; label: string; icon: LucideIcon }

/**
 * Client Workspace navigation (docs/DECISIONS.md 2026-09-26): the
 * TargetGum primary tabs from the approved reference - Learn, Practice,
 * Quests, Shop, Profile - with the client's Home first and every other
 * section under More. Below `md` the five learning tabs also appear as a
 * fixed bottom bar, like a mobile app. Every entry is an existing route;
 * nothing here links to a page that isn't built.
 */
const PRIMARY: Tab[] = [
  { href: '', label: 'Home', icon: Home },
  { href: '/growth', label: 'Learn', icon: MapIcon },
  { href: '/practice', label: 'Practice', icon: Dumbbell },
  { href: '/quests', label: 'Quests', icon: Target },
  { href: '/shop', label: 'Shop', icon: Store },
  { href: '/profile', label: 'Profile', icon: UserRound },
]

const MORE_CLIENT: Array<{ href: string; label: string }> = [
  { href: '/business', label: 'Business' },
  { href: '/brand', label: 'Brand' },
  { href: '/audience', label: 'Audience Lab' },
  { href: '/marketing', label: 'Marketing' },
  { href: '/connections', label: 'Connections' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/settings', label: 'Settings' },
]

// Agency-wide tools (not client-scoped routes) - same destinations as the sidebar.
const MORE_TOOLS: Array<{ href: string; label: string }> = [
  { href: '/dashboard/ads', label: 'Campaigns' },
  { href: '/dashboard/creatives', label: 'Creative Studio' },
  { href: '/dashboard/ads/analytics', label: 'Analytics' },
  { href: '/dashboard/keywords', label: 'Market Research' },
  { href: '/dashboard/recommendations', label: 'AI Coach Recommendations' },
]

function isActive(pathname: string, base: string, href: string) {
  const full = `${base}${href}`
  return href === '' ? pathname === base : pathname === full || pathname.startsWith(`${full}/`)
}

function MoreMenu({ base, pathname }: { base: string; pathname: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const moreActive = MORE_CLIENT.some((t) => isActive(pathname, base, t.href))

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => setOpen(false), [pathname])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-full flex-col items-center gap-1 border-b-[3px] px-3 pb-2 pt-1.5 text-sm font-semibold transition-colors',
          moreActive
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        <MoreHorizontal className="h-6 w-6" aria-hidden="true" />
        <span className="flex items-center gap-0.5">
          More <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-60 rounded-2xl border-2 border-border bg-card p-2 shadow-popover"
        >
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-caption">
            This client
          </p>
          {MORE_CLIENT.map((t) => (
            <Link
              key={t.href}
              role="menuitem"
              href={`${base}${t.href}`}
              aria-current={isActive(pathname, base, t.href) ? 'page' : undefined}
              className={cn(
                'block rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted',
                isActive(pathname, base, t.href)
                  ? 'bg-primary-tint text-primary'
                  : 'text-foreground',
              )}
            >
              {t.label}
            </Link>
          ))}
          <p className="mt-1 border-t border-border px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-caption">
            Agency tools
          </p>
          {MORE_TOOLS.map((t) => (
            <Link
              key={t.href}
              role="menuitem"
              href={t.href}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function WorkspaceTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname() ?? ''
  const base = `/dashboard/clients/${clientId}`

  return (
    <>
      <div className="flex items-end border-b border-border">
        <nav
          aria-label="Client sections"
          className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto sm:gap-2"
        >
          {PRIMARY.map((tab) => {
            const active = isActive(pathname, base, tab.href)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={`${base}${tab.href}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 border-b-[3px] px-3 pb-2 pt-1.5 text-sm font-semibold transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
                {tab.label}
              </Link>
            )
          })}
        </nav>
        <MoreMenu base={base} pathname={pathname} />
      </div>

      {/* Mobile bottom bar - the learning tabs, always one thumb away. */}
      <nav
        aria-label="Learning"
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY.slice(1).map((tab) => {
            const active = isActive(pathname, base, tab.href)
            const Icon = tab.icon
            return (
              <li key={tab.href}>
                <Link
                  href={`${base}${tab.href}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
