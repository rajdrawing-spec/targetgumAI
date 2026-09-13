'use server'

import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { searchAccessibleClients, type ClientSearchResult } from '@/lib/clients/search'

/**
 * Backs the header's universal search client results
 * (src/components/universal-search.tsx). Deliberately not an
 * `ActionResult`-returning action bound via `useActionState`/`ActionForm`
 * like the rest of this directory's actions - the search box calls this
 * directly per keystroke (debounced client-side), and a typeahead has
 * nothing useful to do with a pending/error UI state, just a result list
 * (possibly empty). Never throws to the caller: no session or no
 * `clients.read` permission (a client-portal user, or a signed-out
 * request racing a redirect) just yields no results, not an error.
 */
export async function searchClientsForHeaderAction(query: string): Promise<ClientSearchResult[]> {
  const ctx = await getCurrentAuthContext()
  if (!ctx || ctx.isClientUser) return []
  try {
    return await searchAccessibleClients(ctx, query)
  } catch {
    return []
  }
}
