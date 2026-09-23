'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Plug, Settings, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCOUNT_ITEMS = [
  { href: '/dashboard/team', label: 'Team', icon: UserCog },
  // Visible to everyone, same as before - users.manage (Super Admin only)
  // is enforced by the page itself via the shared error boundary.
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  // Self-service only (src/lib/users/profile.ts) - always visible, no
  // permission gate needed since it only ever touches the caller's own row.
  { href: '/dashboard/account', label: 'My Account', icon: Settings },
] as const

/** Avatar/account dropdown, replacing the old sidebar's footer block - the natural home for account/org-scoped pages once the sidebar is gone. */
export function AccountMenu({ roleLabel, orgLabel, signOutAction }: { roleLabel: string; orgLabel: string; signOutAction: () => Promise<void> }) {
  const pathname = usePathname()
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-primary transition-transform hover:scale-105"
      >
        {roleLabel.slice(0, 1)}
      </button>

      <div
        className={cn(
          'absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-2xl border-2 border-border bg-card p-1.5 shadow-popover transition-all duration-150',
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
        )}
      >
        <div className="border-b border-border px-3 py-2">
          <p className="truncate text-sm font-bold text-foreground">{roleLabel}</p>
          <p className="truncate text-xs text-muted-foreground">{orgLabel}</p>
        </div>
        <div className="flex flex-col gap-1 py-1.5">
          {ACCOUNT_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                  active ? 'bg-primary-tint text-primary' : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                {item.label}
              </Link>
            )
          })}
        </div>
        <form action={signOutAction} className="border-t border-border pt-1.5">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive-bg"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
