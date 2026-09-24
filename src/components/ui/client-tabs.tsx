'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * In-page tabs over content the server already rendered (Quests, Growth
 * Shop). Switching is instant and needs no server round trip; the URL's
 * `?param=` is kept in sync with `history.replaceState` so a tab is still
 * shareable and survives a revalidation.
 *
 * Use FilterTabs instead when switching must re-query the server. Chosen
 * over it here because search-param-only <Link> navigations inside the
 * Client Workspace were measured dropping intermittently (docs/
 * DECISIONS.md 2026-09-24) - and the data is on the page anyway.
 * Keyboard: arrow keys / Home / End move between tabs (WAI-ARIA tabs).
 */
export function ClientTabs({
  param,
  initial,
  tabs,
  label,
  className,
  basePath,
}: {
  /**
   * Pathname to settle on once the user switches tab - drops a one-time
   * flag segment like `/quests/claimed/<key>` so a reload doesn't
   * celebrate again. Omit to keep the current pathname.
   */
  basePath?: string
  param: string
  initial: string
  tabs: Array<{ value: string; label: string; count?: number; content: ReactNode }>
  label: string
  className?: string
}) {
  const [active, setActive] = useState(() => (tabs.some((t) => t.value === initial) ? initial : tabs[0]?.value))
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function select(value: string, index: number) {
    setActive(value)
    refs.current[index]?.focus()
    try {
      const url = new URL(window.location.href)
      if (basePath) url.pathname = basePath
      if (index === 0) url.searchParams.delete(param)
      else url.searchParams.set(param, value)
      // `null` state, per the Next.js docs: Next patches replaceState and
      // skips syncing its router for calls carrying its own internal
      // history state - passing window.history.state left the router on
      // the old URL, so the next Server Action re-rendered the wrong tab.
      window.history.replaceState(null, '', url)
    } catch {
      // URL sync is a convenience; the tab still switches.
    }
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    select(tabs[next]!.value, next)
  }

  return (
    <div className={cn('space-y-5', className)}>
      <div role="tablist" aria-label={label} className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab, i) => {
          const selected = tab.value === active
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.value, i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'bg-card text-foreground shadow-subtle' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className={cn('rounded-full px-1.5 text-xs tabular-nums', selected ? 'bg-muted text-muted-foreground' : 'bg-card/60 text-caption')}>{tab.count}</span>
              )}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          id={`${id}-panel-${tab.value}`}
          aria-labelledby={`${id}-tab-${tab.value}`}
          hidden={tab.value !== active}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
