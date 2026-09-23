'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft } from 'lucide-react'
import { NAV_ITEMS } from './dashboard-nav'
import { searchClientsForHeaderAction } from '@/app/dashboard/search-actions'
import type { ClientSearchResult } from '@/lib/clients/search'
import { cn } from '@/lib/utils'

/**
 * Header quick-search (BRD-PRD dashboard UI work, 2026-09-13): jumps to a
 * page or a client by name. Reuses the same NAV_ITEMS the sidebar renders
 * (src/components/dashboard-nav.tsx) rather than a second hardcoded list,
 * and only ever queries clients through `searchAccessibleClients`'s
 * existing tenant/permission scoping (src/lib/clients/search.ts) - this
 * component never sees data the signed-in user couldn't already reach via
 * the sidebar/Client Workspaces page.
 *
 * Pure client-side navigation aid, not an app-wide content index - it does
 * not search inside campaigns, reports, or any other record type. Colors/
 * fonts all come from the existing CSS variable tokens and font classes
 * already used elsewhere in this header/sidebar, unchanged.
 */
type NavMatch = { kind: 'nav'; href: string; label: string; icon: (typeof NAV_ITEMS)[number]['icon'] }
type ClientMatch = { kind: 'client'; href: string; label: string; sublabel: string }
type Match = NavMatch | ClientMatch

export function UniversalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])

  const navMatches: NavMatch[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 5)
      .map((item) => ({ kind: 'nav', href: item.href, label: item.label, icon: item.icon }))
  }, [query])

  const clientMatches: ClientMatch[] = useMemo(
    () =>
      clientResults.map((c) => ({
        kind: 'client',
        href: `/dashboard/clients/${c.id}`,
        label: c.name,
        sublabel: c.slug,
      })),
    [clientResults],
  )

  const matches: Match[] = useMemo(() => [...navMatches, ...clientMatches], [navMatches, clientMatches])

  // Debounced client lookup - a keystroke does not need a round trip.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setClientResults([])
      return
    }
    const timer = setTimeout(() => {
      searchClientsForHeaderAction(trimmed)
        .then(setClientResults)
        .catch(() => setClientResults([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => setActiveIndex(0), [query])

  // "/" focuses the search box from anywhere on the page, unless the user
  // is already typing into some other field - the same convention the
  // reference (Google Cloud Console) header uses.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close on an outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function go(match: Match) {
    router.push(match.href)
    setQuery('')
    setClientResults([])
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDownInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const match = matches[activeIndex] ?? matches[0]
      if (match) go(match)
    }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDownInput}
          placeholder="Search pages and clients..."
          aria-label="Universal search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="universal-search-results"
          autoComplete="off"
          className="h-9 w-full rounded-full border border-border bg-muted pl-9 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:bg-card"
        />
        {!query && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
            /
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div
          id="universal-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-card py-2 shadow-popover"
        >
          {matches.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">No results for &quot;{query}&quot;</p>
          ) : (
            <>
              {navMatches.length > 0 && (
                <SearchGroup label="Pages">
                  {navMatches.map((m) => (
                    <SearchRow
                      key={m.href}
                      active={matches.indexOf(m) === activeIndex}
                      onClick={() => go(m)}
                      onMouseEnter={() => setActiveIndex(matches.indexOf(m))}
                    >
                      <m.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{m.label}</span>
                    </SearchRow>
                  ))}
                </SearchGroup>
              )}
              {clientMatches.length > 0 && (
                <SearchGroup label="Clients">
                  {clientMatches.map((m) => (
                    <SearchRow
                      key={m.href}
                      active={matches.indexOf(m) === activeIndex}
                      onClick={() => go(m)}
                      onMouseEnter={() => setActiveIndex(matches.indexOf(m))}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-primary-tint text-[9px] font-bold text-primary">
                        {m.label.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{m.label}</span>
                      <span className="ml-auto shrink-0 truncate text-[11px] text-muted-foreground">{m.sublabel}</span>
                    </SearchRow>
                  ))}
                </SearchGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  )
}

function SearchRow({
  active,
  onClick,
  onMouseEnter,
  children,
}: {
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] text-muted-foreground transition-colors',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
      {active && <CornerDownLeft className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />}
    </button>
  )
}
