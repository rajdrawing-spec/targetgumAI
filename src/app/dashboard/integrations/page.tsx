import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'

const STATUS_STYLE: Record<string, string> = {
  CONNECTED: 'bg-green-50 text-green-700',
  DEGRADED: 'bg-amber-50 text-amber-700',
  AUTH_REQUIRED: 'bg-amber-50 text-amber-700',
  ERROR: 'bg-red-50 text-red-700',
  DISCONNECTED: 'bg-gray-100 text-gray-600',
}

/** BRD-PRD Section 34: last successful sync, last error, connected account, client, provider, health status. Credential expiry isn't tracked in the schema yet - omitted rather than faked. */
export default async function IntegrationsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const connections = await listIntegrationConnectionsForOrg(ctx)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Integrations</h1>
      {connections.length === 0 ? (
        <p className="text-sm text-gray-400">No integrations connected yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500">
            <tr>
              <th className="pb-2 font-medium">Client</th>
              <th className="pb-2 font-medium">Provider</th>
              <th className="pb-2 font-medium">Connected account</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Last successful sync</th>
              <th className="pb-2 font-medium">Last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {connections.map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  <Link href={`/dashboard/clients/${c.clientId}`} className="hover:underline">
                    {c.client.name}
                  </Link>
                </td>
                <td className="py-2">{c.integrationAccount.integration.provider}</td>
                <td className="py-2 text-gray-600">{c.integrationAccount.label ?? c.integrationAccount.externalAccountId}</td>
                <td className="py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="py-2 text-gray-500">
                  {c.lastSuccessfulSyncAt ? c.lastSuccessfulSyncAt.toISOString().slice(0, 16).replace('T', ' ') : '—'}
                </td>
                <td className="py-2 text-gray-500">
                  {c.lastErrorMessage ? (
                    <span title={c.lastErrorAt?.toISOString()}>{c.lastErrorMessage}</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
