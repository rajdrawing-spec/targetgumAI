import { redirect } from 'next/navigation'
import { db } from '@/lib/db/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'

/**
 * Proves the auth -> RBAC -> tenant-scoped-query chain works end to end.
 * This is not the real dashboard (that's Day 13, docs/MVP-CHECKLIST.md) -
 * just enough to show who's signed in, their role, and which clients
 * they're authorized to see.
 */
export default async function DashboardPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const clients = await db.client.findMany({
    where:
      ctx.clientAccess.kind === 'ALL'
        ? { organizationId: ctx.organizationId }
        : { organizationId: ctx.organizationId, id: { in: Array.from(ctx.clientAccess.clientIds) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">Dashboard (foundation placeholder)</h1>
      <dl className="mt-6 space-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Role</dt>
          <dd>{ctx.roleKey}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Accessible clients</dt>
          <dd>
            {clients.length === 0 ? (
              <span className="text-gray-400">None</span>
            ) : (
              <ul className="list-inside list-disc">
                {clients.map((client) => (
                  <li key={client.id}>{client.name}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </main>
  )
}
