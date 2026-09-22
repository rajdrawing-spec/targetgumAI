'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/growth', label: 'Growth Map' },
  { href: '/business', label: 'Business' },
  { href: '/brand', label: 'Brand' },
  { href: '/audience', label: 'Audience' },
  { href: '/marketing', label: 'Marketing' },
  { href: '/connections', label: 'Connections' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/settings', label: 'Settings' },
]

/** Client-scoped tab navigation - preserves the client's context as you move between sections (BRD "navigation should preserve context"). */
export function WorkspaceTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/dashboard/clients/${clientId}`

  return (
    <nav aria-label="Client sections" className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`
        const active = tab.href === '' ? pathname === base : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={tab.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
