import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'

export default async function ClientsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const clients = await listAccessibleClients(ctx)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Clients</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-gray-400">No clients yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {clients.map((client) => (
            <li key={client.id}>
              <Link href={`/dashboard/clients/${client.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <span className="text-sm font-medium">{client.name}</span>
                <span className="text-xs text-gray-500">
                  {client.status} · {client.automationLevel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
