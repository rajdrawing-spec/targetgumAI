import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ScrollText, Filter } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAuditEvents, resolveActorLabels } from '@/lib/audit/record'
import { listAccessibleClients } from '@/lib/clients/list'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * BRD-PRD Section 28. `listAuditEvents` requires `audit.read` - only
 * super_admin holds it by default (Section 4.1), so most viewers land here
 * and get the error boundary's clean "Missing permission" message instead
 * of a crash.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [{ client: clientFilter }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [events, clients] = await Promise.all([
    listAuditEvents(ctx, { clientId: clientFilter || undefined, limit: 200 }),
    listAccessibleClients(ctx),
  ])
  const actorLabels = await resolveActorLabels(ctx, events.map((e) => e.userId))

  return (
    <div className="space-y-6">
      <PageHeader title="Audit trail" description="Every action taken by staff, agents, and tools - never edited or deleted." />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="client" className="mb-1.5 block text-xs font-medium text-caption">
            Client
          </label>
          <select id="client" name="client" defaultValue={clientFilter ?? ''} className="h-9 rounded-md border border-input bg-card px-3 text-sm">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="default">
          <Filter className="h-3.5 w-3.5" /> Filter
        </Button>
        {clientFilter && (
          <Link href="/dashboard/audit" className="text-sm text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        )}
      </form>

      {events.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit events yet" description="Events are recorded as soon as anyone - or any agent - acts on a client." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-caption">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Actor</th>
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
                  <td className="px-4 py-3">
                    {event.client ? (
                      <Link href={`/dashboard/clients/${event.client.id}`} className="text-foreground hover:text-primary">
                        {event.client.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.userId ? (actorLabels.get(event.userId) ?? 'Unknown user') : event.agentId ? 'AI agent' : 'System'}
                  </td>
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
