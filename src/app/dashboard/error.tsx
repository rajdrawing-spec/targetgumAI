'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'

/**
 * Segment-level error boundary for the whole /dashboard tree (BRD-PRD
 * "error states", Day 14). Next.js renders this in place of the failed
 * page/layout whenever a Server Component, Server Action, or their data
 * fetching throws - a ForbiddenError from a permission check, an
 * IntegrationUnavailableError, an AiGatewayError from "Analyze this
 * client" when Claude/an integration is unreachable, etc. Without this,
 * any of those would render Next's generic, unstyled crash page instead
 * of a message the user can act on.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-destructive/20 bg-destructive-bg p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-destructive">Something went wrong</h1>
          <p className="mt-1 text-sm text-destructive/90">{error.message || 'An unexpected error occurred.'}</p>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Back to Overview
        </Link>
      </div>
    </div>
  )
}
