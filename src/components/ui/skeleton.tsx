import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading placeholder. Used by every route segment's `loading.tsx` so a
 * navigation paints an outline of the page immediately instead of leaving
 * the previous page frozen until the whole server payload arrives (see
 * docs/UX-ASSESSMENT.md - the app is round-trip-bound, not CPU-bound, so
 * perceived speed depends on painting something at once).
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

/** A card-shaped skeleton: title line + a few body lines. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-card', className)}>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3.5', i % 3 === 2 ? 'w-1/2' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

/** Table-shaped skeleton: a header row + `rows` body rows. */
export function SkeletonTable({ rows = 6, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-card', className)}>
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[40%]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Page header skeleton (title + description). */
export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80" />
    </div>
  )
}
