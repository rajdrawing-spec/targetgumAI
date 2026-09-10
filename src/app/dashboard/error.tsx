'use client'

import Link from 'next/link'

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
    <div className="mx-auto max-w-lg rounded border border-red-200 bg-red-50 p-6 text-sm">
      <h1 className="font-semibold text-red-800">Something went wrong</h1>
      <p className="mt-2 text-red-700">{error.message || 'An unexpected error occurred.'}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
        >
          Try again
        </button>
        <Link href="/dashboard" className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100">
          Back to Overview
        </Link>
      </div>
    </div>
  )
}
