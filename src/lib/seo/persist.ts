import { db } from '@/lib/db/client'
import { getAuthorizedClient, scopedClientWhere } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { SEO_AGENT_KEY } from '@/lib/agents/seo-agent'

/**
 * Read-only helpers for surfacing what the SEO Agent
 * (src/lib/agents/seo-agent.ts) produced. Recommendations are identified
 * via `AiRun.contextIds.agentKey` (set by the AI Gateway on every run,
 * src/lib/ai/gateway.ts) rather than the recommendation's free-text `area`
 * field - the SEO Agent's prompt deliberately keeps `area` specific and
 * varied ("Query CTR", "Page rankings", ...), which is more useful to read
 * than a constant "SEO" repeated on every card, but not something a UI
 * filter should have to trust matching on. No new persistence here -
 * `createContentCalendarItem`-style writes don't apply; recommendations
 * from this agent are written by the generic `persistRecommendations`
 * (src/lib/recommendations/persist.ts), same as every other agent's.
 */

export async function listSeoRecommendationsForOrg(ctx: AuthContext, filter: { limit?: number } = {}) {
  assertPermission(ctx, 'clients.read')
  return db.recommendation.findMany({
    where: {
      ...scopedClientWhere(ctx),
      aiRun: { contextIds: { path: ['agentKey'], equals: SEO_AGENT_KEY } },
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
  })
}

export async function listSeoRecommendations(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.recommendation.findMany({
    where: {
      clientId,
      aiRun: { contextIds: { path: ['agentKey'], equals: SEO_AGENT_KEY } },
    },
    orderBy: { createdAt: 'desc' },
  })
}
