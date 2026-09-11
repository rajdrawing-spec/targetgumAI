import { cache } from 'react'
import { db } from '@/lib/db/client'
import { resolveAuthContext, resolveDefaultAuthContext, resolveDefaultOrganizationId } from '@/lib/rbac/context'
import type { AuthContext } from '@/lib/rbac/types'
import { auth } from './index'

/**
 * Resolves the full AuthContext for the current request/server component,
 * defaulting into the user's first organization when none is specified (see
 * resolveDefaultOrganizationId - no multi-org switcher yet, Phase 2).
 * Returns null if there's no session or no valid membership - callers pass
 * that through src/lib/rbac/guards.ts `requireAuthContext`.
 *
 * Wrapped in React `cache()`: the dashboard layout and every page under it
 * each call this, and Server Actions call it again - before this, the
 * 7-query authorization chain ran twice per navigation, sequentially,
 * before any page data was requested (docs/UX-ASSESSMENT.md §5). `cache()`
 * dedupes it to once per request; it is never shared across requests, so
 * a disabled user is still denied on their very next request.
 */
export const getCurrentAuthContext = cache(async (organizationId?: string): Promise<AuthContext | null> => {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  if (organizationId) {
    return resolveAuthContext(db, userId, organizationId)
  }
  // The common path (no explicit org) resolves membership + role +
  // permissions + client access in one round instead of looking the
  // default organization up first and then re-fetching the membership.
  return resolveDefaultAuthContext(db, userId)
})

/** Exposed for the (rare) callers that only need the org id. */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null
  return resolveDefaultOrganizationId(db, userId)
}
