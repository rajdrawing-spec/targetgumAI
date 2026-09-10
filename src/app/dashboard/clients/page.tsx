import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'
import { createClientAction } from '../actions'

export default async function ClientsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const clients = await listAccessibleClients(ctx)
  // Client creation is Super Admin territory (BRD Section 4.1 "Manage
  // clients"); Account Manager's "manage assigned clients" (4.2) is about
  // clients they're already assigned to, not creating new ones.
  const canCreate = ctx.permissions.has('clients.manage')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
      </div>

      {canCreate && (
        <form action={createClientAction} className="flex items-end gap-2 rounded border border-gray-200 p-3">
          <div className="flex-1">
            <label htmlFor="name" className="block text-xs text-gray-500">
              New client name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Acme Retail"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
            Create client
          </button>
        </form>
      )}

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
