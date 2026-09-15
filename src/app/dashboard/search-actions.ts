'use server'

import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { searchAccessibleClients, type ClientSearchResult } from '@/lib/clients/search'
import { answerMarketingQuestion, type MarketingSearchResult } from '@/lib/search/marketing-search'

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

export type MarketingSearchActionResult = { ok: true; result: MarketingSearchResult } | { ok: false; error: string }

/**
 * The main dashboard's "ask anything about your marketing" bar
 * (src/components/dashboard/marketing-search-bar.tsx). Same
 * not-`ActionResult` shape as the header search above - a question/answer
 * exchange has nothing to do with a form's pending/success/error
 * convention.
 */
export async function askMarketingSearchAction(query: string): Promise<MarketingSearchActionResult> {
  try {
    const ctx = await getCurrentAuthContext()
    if (!ctx || ctx.isClientUser) return { ok: false, error: 'Sign in as staff to search.' }
    const result = await answerMarketingQuestion(ctx, query)
    return { ok: true, result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not answer that right now.' }
  }
}
