import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plug, ArrowUpRight } from 'lucide-react'
import type { IntegrationHealth } from '@prisma/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterTabs } from '@/components/ui/filter-tabs'

const NEEDS_ATTENTION: IntegrationHealth[] = ['AUTH_REQUIRED', 'ERROR', 'DEGRADED', 'DISCONNECTED']

const TABS: Array<{ value: string; label: string; status?: IntegrationHealth[] }> = [
  { value: 'all', label: 'All' },
  { value: 'attention', label: 'Needs attention', status: NEEDS_ATTENTION },
  { value: 'connected', label: 'Connected', status: ['CONNECTED'] },
]

/** BRD-PRD Section 34: last successful sync, last error, connected account, client, provider, health status. Credential expiry isn't tracked in the schema yet - omitted rather than faked. */
export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status: statusParam }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const tab = TABS.find((t) => t.value === statusParam) ?? TABS[0]!
  const connections = await listIntegrationConnectionsForOrg(ctx, { status: tab.status })

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connection health for every client's data source. Connect, reconnect or disconnect from the client's workspace." />

      <FilterTabs param="status" value={tab.value} options={TABS} basePath="/dashboard/integrations" />

      {connections.length === 0 ? (
        <EmptyState
          icon={Plug}
          title={tab.value === 'attention' ? 'Every connection is healthy' : 'No integrations connected yet'}
          description={tab.value === 'attention' ? undefined : 'Open a client and connect Metricool, Google Ads, Meta Ads or Canva from its Integrations section.'}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-caption">
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-4 py-3 font-medium">Client</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Provider</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Connected account</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Last successful sync</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Last error</th>
                <th className="px-4 py-3 font-medium"></th>
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
                  <td className="max-w-xs px-4 py-3 text-destructive">
                    {c.lastErrorMessage ? <span title={c.lastErrorAt?.toISOString()}>{c.lastErrorMessage}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.clientId}#integrations`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline">
                      {NEEDS_ATTENTION.includes(c.status) ? 'Reconnect' : 'Manage'} <ArrowUpRight className="h-3 w-3" />
                    </Link>
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
