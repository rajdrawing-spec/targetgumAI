import { getAuthorizedClient } from '@/lib/db/tenant'
import { listAccessibleClients } from '@/lib/clients/list'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'

/** Preference cookie holding the last Client Workspace opened (set by RememberClient). */
export const LAST_CLIENT_COOKIE = 'tg_last_client'

/** The app-wide Learn navigation targets (sidebar "Learn" group) -> the client-workspace segment each opens. */
export const LEARN_SECTIONS = {
  learn: 'growth',
  practice: 'practice',
  quests: 'quests',
  shop: 'shop',
  profile: 'profile',
} as const
export type LearnSection = keyof typeof LEARN_SECTIONS

/**
 * Which client the sidebar's Learn links should open (docs/DECISIONS.md
 * 2026-09-26). Gamification is per client, so "Learn" needs one:
 * the last workspace the user opened (a plain preference cookie) if they
 * can still access it, otherwise their first accessible non-archived
 * client, otherwise null. The cookie is never trusted - it is re-checked
 * with `getAuthorizedClient` every time, and a client outside the
 * caller's access is treated exactly like a missing one.
 */
export async function resolveLearnClientId(ctx: AuthContext, preferredClientId: string | null | undefined): Promise<string | null> {
  if (preferredClientId) {
    try {
      const client = await getAuthorizedClient(ctx, preferredClientId)
      if (client.organizationId === ctx.organizationId && client.status !== 'ARCHIVED') return client.id
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error
    }
  }
  if (!ctx.permissions.has('clients.read')) return null
  const clients = await listAccessibleClients(ctx)
  return (clients.find((c) => c.status !== 'ARCHIVED') ?? null)?.id ?? null
}
