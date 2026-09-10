import { db } from '@/lib/db/client'
import { resolveAuthContext, resolveDefaultOrganizationId } from '@/lib/rbac/context'
import type { AuthContext } from '@/lib/rbac/types'
import { auth } from './index'

/**
 * Resolves the full AuthContext for the current request/server component,
 * defaulting into the user's first organization when none is specified (see
 * resolveDefaultOrganizationId - no multi-org switcher yet, Phase 2).
 * Returns null if there's no session or no valid membership - callers pass
 * that through src/lib/rbac/guards.ts `requireAuthContext`.
 */
export async function getCurrentAuthContext(organizationId?: string): Promise<AuthContext | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  const orgId = organizationId ?? (await resolveDefaultOrganizationId(db, userId))
  if (!orgId) return null

  return resolveAuthContext(db, userId, orgId)
}
