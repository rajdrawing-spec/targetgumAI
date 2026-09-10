import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'

/**
 * A `client_user` is normally linked to exactly one client - go straight
 * there. The rare multi-client case (one contact representing two brands,
 * `ClientUser` has no unique-per-user constraint) gets a picker instead of
 * guessing.
 */
export default async function PortalOverviewPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const clients = await listAccessibleClients(ctx)

  if (clients.length === 1) {
    redirect(`/portal/clients/${clients[0]!.id}`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Your clients</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-gray-400">No client is linked to your account yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {clients.map((client) => (
            <li key={client.id}>
              <Link href={`/portal/clients/${client.id}`} className="block px-4 py-3 text-sm hover:bg-gray-50">
                {client.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
