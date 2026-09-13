import { db } from '@/lib/db/client'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

export interface ClientSearchResult {
  id: string
  name: string
  slug: string
}

/**
 * Same tenant scoping as `listAccessibleClients` (src/lib/clients/list.ts),
 * narrowed to a name search with a result cap - powers the dashboard
 * header's universal search (src/components/universal-search.tsx). Never
 * widens access: a `SET`-access caller only ever matches within their own
 * assigned client ids, same as every other client-scoped read.
 */
export async function searchAccessibleClients(
  ctx: AuthContext,
  query: string,
  limit = 6,
): Promise<ClientSearchResult[]> {
  assertPermission(ctx, 'clients.read')
  const trimmed = query.trim()
  if (!trimmed) return []

  return db.client.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.clientAccess.kind === 'SET' && { id: { in: Array.from(ctx.clientAccess.clientIds) } }),
      name: { contains: trimmed, mode: 'insensitive' },
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: { id: true, name: true, slug: true },
  })
}
