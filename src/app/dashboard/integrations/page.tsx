import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plug } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

/** BRD-PRD Section 34: last successful sync, last error, connected account, client, provider, health status. Credential expiry isn't tracked in the schema yet - omitted rather than faked. */
export default async function IntegrationsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const connections = await listIntegrationConnectionsForOrg(ctx)

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connection health for every client's data source." />

      {connections.length === 0 ? (
        <EmptyState icon={Plug} title="No integrations connected yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-caption">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Connected account</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last successful sync</th>
                <th className="px-4 py-3 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {connections.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.clientId}`} className="font-medium text-foreground hover:text-primary">
                      {c.client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{c.integrationAccount.integration.provider}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.integrationAccount.label ?? c.integrationAccount.externalAccountId}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-caption">
                    {c.lastSuccessfulSyncAt ? c.lastSuccessfulSyncAt.toISOString().slice(0, 16).replace('T', ' ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-destructive">
                    {c.lastErrorMessage ? <span title={c.lastErrorAt?.toISOString()}>{c.lastErrorMessage}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
