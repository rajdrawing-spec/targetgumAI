import type { HTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'bg-muted text-muted-foreground',
      success: 'bg-success-bg text-success',
      warning: 'bg-warning-bg text-warning',
      destructive: 'bg-destructive-bg text-destructive',
      info: 'bg-info-bg text-info',
      accent: 'bg-accent text-accent-foreground',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/**
 * Maps the app's various status/priority/risk enum strings to a Badge
 * variant, so every page renders the same word the same color instead of
 * each page inventing its own mapping. Falls back to `neutral` for
 * anything unrecognized rather than guessing.
 */
const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  // Integration health
  CONNECTED: 'success',
  DEGRADED: 'warning',
  AUTH_REQUIRED: 'warning',
  ERROR: 'destructive',
  DISCONNECTED: 'neutral',
  // Approvals
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  EXECUTED: 'success',
  FAILED: 'destructive',
  // Recommendations
  DETECTED: 'neutral',
  ANALYZED: 'neutral',
  RECOMMENDED: 'info',
  ACCEPTED: 'success',
  VERIFIED: 'success',
  // Tasks
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  BLOCKED: 'destructive',
  DONE: 'success',
  // AI runs / workflow runs
  RUNNING: 'warning',
  SUCCEEDED: 'success',
  SKIPPED: 'neutral',
  // Audit
  SUCCESS: 'success',
  DENIED: 'warning',
  FAILURE: 'destructive',
  // Priority / risk
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'destructive',
  URGENT: 'destructive',
  // Ad performance diagnostic severity (src/lib/ads/analyzer.ts's DiagnosticItem)
  WARNING: 'warning',
  OPPORTUNITY: 'info',
  HEALTHY: 'success',
  // Content calendar (ContentStatus) - APPROVED/CANCELLED/FAILED above are shared.
  IDEA: 'neutral',
  DRAFT: 'neutral',
  IN_REVIEW: 'info',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
}

/** "IN_PROGRESS" -> "In progress" - sentence case, not the raw enum shouting case. */
export function toSentenceCase(status: string): string {
  const words = status.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function StatusBadge({
  status,
  className,
  children,
}: {
  status: string
  className?: string
  /** Appended after the default label - e.g. a count. */
  children?: ReactNode
}) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} className={className}>
      {toSentenceCase(status)}
      {children}
    </Badge>
  )
}
