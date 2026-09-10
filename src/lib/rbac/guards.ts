import { AuthenticationError, ForbiddenError } from './errors'
import type { Permission } from './permissions'
import type { AuthContext } from './types'

/** Throws if the resolved context lacks `permission`. */
export function assertPermission(ctx: AuthContext, permission: Permission): void {
  if (!ctx.permissions.has(permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`)
  }
}

/**
 * Throws if `client` is outside the caller's authorized organization/client
 * set. This is the tenant-isolation check every client-scoped read/write
 * must go through - see docs/SECURITY.md invariant #1.
 */
export function assertClientAccess(
  ctx: AuthContext,
  client: { id: string; organizationId: string },
): void {
  if (client.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Client does not belong to the authorized organization.')
  }
  if (ctx.clientAccess.kind === 'SET' && !ctx.clientAccess.clientIds.has(client.id)) {
    throw new ForbiddenError('Not authorized for this client.')
  }
}

/** Narrows `AuthContext | null` to `AuthContext`, or throws AuthenticationError. */
export function requireAuthContext(ctx: AuthContext | null): AuthContext {
  if (!ctx) throw new AuthenticationError()
  return ctx
}
