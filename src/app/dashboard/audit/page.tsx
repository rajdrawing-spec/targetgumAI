import { redirect } from 'next/navigation'
import { ScrollText } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAuditEvents } from '@/lib/audit/record'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * BRD-PRD Section 28. `listAuditEvents` requires `audit.read` - only
 * super_admin holds it by default (Section 4.1), so most viewers land here
 * and get the Day 14 error boundary's clean "Missing permission" message
 * instead of a crash - itself part of Day 14's "error states" coverage.
 */
export default async function AuditPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const events = await listAuditEvents(ctx, { limit: 200 })

  return (
    <div className="space-y-6">
      <PageHeader title="Audit trail" description="Every action taken by staff, agents, and tools - never edited or deleted." />

      {events.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit events yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-caption">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Provider / tool</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-caption">{event.timestamp.toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{event.action}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={event.result} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{[event.provider, event.tool].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-4 py-3 text-destructive">{event.error ?? <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
