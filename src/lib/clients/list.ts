import { db } from '@/lib/db/client'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Org-wide client listing, scoped to the caller's authorized set (all
 * clients for `ALL`-access roles, only assigned/linked clients otherwise).
 * Used by the dashboard (Day 13) - single-client reads still go through
 * `getAuthorizedClient` (src/lib/db/tenant.ts). Deliberately not built on
 * `scopedClientWhere` (src/lib/db/tenant.ts): that helper's shape
 * (`{ clientId: { in: [...] } }`) fits client-*owned* rows, but `Client`
 * itself is keyed by `id`, not `clientId`.
 */
export async function listAccessibleClients(ctx: AuthContext) {
  assertPermission(ctx, 'clients.read')
  const where =
    ctx.clientAccess.kind === 'ALL'
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, id: { in: Array.from(ctx.clientAccess.clientIds) } }
  return db.client.findMany({ where, orderBy: { name: 'asc' } })
}
