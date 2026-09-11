import { cache } from 'react'
import { ForbiddenError } from '@/lib/rbac/errors'
import { assertClientAccess } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { db } from './client'

/**
 * The canonical way to fetch a single client scoped to the caller's
 * authorization context. Prefer this over `db.client.findUnique` anywhere a
 * clientId comes from a request - see docs/SECURITY.md invariant #1.
 *
 * Throws ForbiddenError - never returns another organization's/client's
 * data - whether the client doesn't exist, belongs to a different
 * organization, or simply isn't in the caller's authorized set. The error
 * is deliberately identical in all three cases so callers can't probe for
 * the existence of clients outside their access.
 */
export async function getAuthorizedClient(ctx: AuthContext, clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) {
    throw new ForbiddenError('Not authorized for this client.')
  }
  assertClientAccess(ctx, client)
  return client
}

/**
 * `getAuthorizedClient`, deduped per request with React `cache()` - the
 * Client Workspace's layout and every one of its tab pages (Overview,
 * Business, Brand, Audience, Marketing, Integrations, Settings) need the
 * same authorized client row for the same request; without this each tab
 * navigation repeated the lookup. Read-only call sites should prefer this;
 * mutation call sites keep using the uncached `getAuthorizedClient`
 * directly so a Server Action always reads the current row, never a value
 * cached from earlier in the same request.
 */
export const getAuthorizedClientCached = cache(getAuthorizedClient)

/**
 * Prisma `where` fragment for listing client-owned rows within the caller's
 * authorized set. Spread this into any `db.<model>.findMany({ where: {...} })`
 * call alongside the model's own filters - never query a client-owned model
 * without it.
 */
export function scopedClientWhere(ctx: AuthContext): { organizationId: string; clientId?: { in: string[] } } {
  if (ctx.clientAccess.kind === 'ALL') {
    return { organizationId: ctx.organizationId }
  }
  return { organizationId: ctx.organizationId, clientId: { in: Array.from(ctx.clientAccess.clientIds) } }
}
