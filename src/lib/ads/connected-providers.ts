import type { IntegrationHealth, IntegrationProvider } from '@prisma/client'
import { db } from '@/lib/db/client'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * The three ad platforms the guided campaign wizard can actually launch
 * on - the only providers with a real, write-capable `AdsProvider` adapter
 * and a `create_campaign` tool (BRD Section 109).
 */
export const AD_CAMPAIGN_PROVIDERS = ['META_ADS', 'GOOGLE_ADS', 'AMAZON_ADS'] as const
export type AdCampaignProvider = (typeof AD_CAMPAIGN_PROVIDERS)[number]

/** A connection is usable for launching a new campaign if it's at least DEGRADED - AUTH_REQUIRED/ERROR/DISCONNECTED can't take a real write. */
const USABLE_HEALTH: ReadonlySet<IntegrationHealth> = new Set(['CONNECTED', 'DEGRADED'])

/**
 * Which of the three ad platforms are actually usable for each client the
 * caller can access - one query, not three-per-client, so the wizard's
 * client-picker and platform-picker steps can both work off one server
 * fetch with no extra round trip when the user changes their client
 * selection mid-wizard.
 */
export async function mapConnectedAdProvidersByClient(
  ctx: AuthContext,
  clientIds: string[],
): Promise<Map<string, Set<AdCampaignProvider>>> {
  assertPermission(ctx, 'clients.read')
  if (clientIds.length === 0) return new Map()

  const connections = await db.integrationConnection.findMany({
    where: {
      organizationId: ctx.organizationId,
      clientId: { in: clientIds },
      integrationAccount: { integration: { provider: { in: AD_CAMPAIGN_PROVIDERS as unknown as IntegrationProvider[] } } },
    },
    select: {
      clientId: true,
      status: true,
      integrationAccount: { select: { integration: { select: { provider: true } } } },
    },
  })

  const map = new Map<string, Set<AdCampaignProvider>>()
  for (const c of connections) {
    if (!USABLE_HEALTH.has(c.status)) continue
    const provider = c.integrationAccount.integration.provider as AdCampaignProvider
    const set = map.get(c.clientId) ?? new Set<AdCampaignProvider>()
    set.add(provider)
    map.set(c.clientId, set)
  }
  return map
}

/**
 * Each accessible client's `ClientPolicy.maxDailyAdBudget`, if set - lets
 * the wizard's review step warn (never block - a human is reviewing every
 * launch here, this is informational) when the entered daily budget
 * exceeds the client's own stated cap, the same field Phase 3's automated
 * dispatcher enforces for AI-proposed budget changes
 * (src/lib/automation/dispatch-proposed-actions.ts) - here it's a
 * heads-up for a human doing the same thing manually, not a gate.
 */
export async function mapDailyBudgetCapByClient(ctx: AuthContext, clientIds: string[]): Promise<Map<string, number>> {
  assertPermission(ctx, 'clients.read')
  if (clientIds.length === 0) return new Map()

  const policies = await db.clientPolicy.findMany({
    where: { clientId: { in: clientIds }, maxDailyAdBudget: { not: null } },
    select: { clientId: true, maxDailyAdBudget: true },
  })
  return new Map(policies.map((p) => [p.clientId, p.maxDailyAdBudget!.toNumber()]))
}
