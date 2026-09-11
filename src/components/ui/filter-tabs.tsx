import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * URL-backed filter tabs for list pages. Each tab is a plain link that sets
 * one query parameter, so filters are shareable/bookmarkable, work without
 * JavaScript, and the page re-renders on the server with the filter
 * applied - no client-side re-fetch of data the server already narrowed.
 * Counts are optional and only shown when the caller has real numbers.
 */
export function FilterTabs({
  param,
  value,
  options,
  basePath,
  preserve = {},
  className,
}: {
  param: string
  /** Currently selected value ('' or undefined = the first/default option). */
  value?: string
  options: Array<{ value: string; label: string; count?: number }>
  basePath: string
  /** Other query params to keep while switching this one. */
  preserve?: Record<string, string | undefined>
  className?: string
}) {
  const current = value || options[0]?.value
  return (
    <nav aria-label="Filter" className={cn('flex flex-wrap gap-1 rounded-lg bg-muted p-1', className)}>
      {options.map((option) => {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(preserve)) if (v) params.set(k, v)
        if (option.value !== options[0]?.value) params.set(param, option.value)
        const query = params.toString()
        const active = option.value === current
        return (
          <Link
            key={option.value}
            href={query ? `${basePath}?${query}` : basePath}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-subtle' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.count != null && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-muted text-muted-foreground' : 'bg-card/60 text-caption')}>
                {option.count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
