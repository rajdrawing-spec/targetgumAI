'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { AUTOMATION_LEVELS } from '@/lib/clients/options'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Search / filter / sort controls for the Clients list. State lives in the
 * URL (shareable, back-button friendly); changes are applied with a
 * transition so the existing rows stay visible with a small spinner while
 * the server re-renders the narrowed list - no client-side data fetching,
 * no flash of an empty page. Search is debounced to one navigation per
 * pause in typing.
 */
export function ClientsToolbar({ managers }: { managers: Array<{ id: string; label: string }> }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const query = next.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  useEffect(() => {
    if (q === (params.get('q') ?? '')) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => set('q', q.trim()), 250)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `set` is stable enough for a debounce; params is read inside
  }, [q])

  const hasFilters = ['q', 'status', 'automation', 'manager', 'health', 'sort'].some((k) => params.get(k))
  const selectClass = 'h-9 rounded-md border border-input bg-card px-2.5 text-sm text-foreground shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="flex flex-wrap items-center gap-2" role="search">
      <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, website, industry, contact…"
          aria-label="Search clients"
          className="pl-8"
        />
      </div>
      <select aria-label="Status" className={selectClass} value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)}>
        <option value="">Active & paused</option>
        <option value="ACTIVE">Active</option>
        <option value="PAUSED">Paused</option>
        <option value="ARCHIVED">Archived</option>
        <option value="ALL">All</option>
      </select>
      <select aria-label="Automation" className={selectClass} value={params.get('automation') ?? ''} onChange={(e) => set('automation', e.target.value)}>
        <option value="">Any automation</option>
        {AUTOMATION_LEVELS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      <select aria-label="Account manager" className={selectClass} value={params.get('manager') ?? ''} onChange={(e) => set('manager', e.target.value)}>
        <option value="">Any manager</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <select aria-label="Integration health" className={selectClass} value={params.get('health') ?? ''} onChange={(e) => set('health', e.target.value)}>
        <option value="">Any integrations</option>
        <option value="attention">Needs attention</option>
        <option value="connected">Connected</option>
        <option value="none">None connected</option>
      </select>
      <select aria-label="Sort" className={selectClass} value={params.get('sort') ?? ''} onChange={(e) => set('sort', e.target.value)}>
        <option value="">Recently updated</option>
        <option value="name">Client name</option>
        <option value="attention">Attention required</option>
        <option value="activity">Last activity</option>
      </select>
      <div className={cn('flex h-9 items-center gap-2 text-xs text-muted-foreground', !pending && !hasFilters && 'invisible')}>
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setQ('')
              startTransition(() => router.replace(pathname, { scroll: false }))
            }}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
