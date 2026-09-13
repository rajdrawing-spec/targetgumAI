import type { IntegrationProvider } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { connectClientToProviderAccount, recordIntegrationSuccess } from './health'

/**
 * The client Workspace's "Connections" tab (structure-first, per
 * docs/DECISIONS.md - no real social/web API is wired up yet, deliberately;
 * "later i will do api things, first build the structure" was the explicit
 * ask). Covers the newer social/web `IntegrationProvider` values (WEB,
 * BLOG, FACEBOOK, INSTAGRAM, THREADS, TWITTER_X, BLUESKY, PINTEREST,
 * TIKTOK_PERSONAL, TIKTOK_BUSINESS, GOOGLE_BUSINESS_PROFILE, LINKEDIN) plus
 * the ad platforms (META_ADS, GOOGLE_ADS, AMAZON_ADS, TIKTOK_ADS) shown
 * read-only here (their real connect flows already live on the
 * Integrations tab - `connectClientToMetaAdsAccount` etc - and are never
 * duplicated or reachable through this simpler path, so this can never
 * clobber a real, credentialed connection with a placeholder label).
 *
 * Deliberately reuses the same `Integration`/`IntegrationAccount`/
 * `IntegrationConnection` tables every other provider already uses
 * (`src/lib/integrations/health.ts`) rather than a parallel schema - same
 * tenant scoping, health tracking, and RBAC gate as everywhere else.
 */

/** Providers whose real connect flow lives elsewhere (Integrations tab) - shown read-only on the Connections tab, never connectable/disconnectable from here. */
const READ_ONLY_ON_CONNECTIONS_TAB: ReadonlySet<IntegrationProvider> = new Set([
  'METRICOOL',
  'CANVA',
  'GA4',
  'GOOGLE_SEARCH_CONSOLE',
  'GOOGLE_ADS',
  'META_ADS',
])

function assertConnectable(provider: IntegrationProvider): void {
  if (READ_ONLY_ON_CONNECTIONS_TAB.has(provider)) {
    throw new Error(`${provider} is connected from the Integrations tab, not here.`)
  }
}

/**
 * Connects a client to a platform with no real API/OAuth wired up yet -
 * captures a handle/page name as a placeholder so the *shape* of a
 * multi-platform connection exists (BRD Section 92's "mock before real"
 * sequencing, one step earlier: there's no mock provider to call yet
 * either). Marked CONNECTED immediately - there is nothing to verify
 * against. Never claims a real, working connection; once a real adapter
 * exists for a given platform, replace this call site the same way
 * `connectClientToMetaAdsAccount` etc. already do for their providers.
 */
export async function connectClientToPlaceholderAccount(
  ctx: AuthContext,
  clientId: string,
  provider: IntegrationProvider,
  label: string,
) {
  assertPermission(ctx, 'integrations.manage')
  assertConnectable(provider)
  await getAuthorizedClient(ctx, clientId)

  const trimmed = label.trim()
  if (!trimmed) throw new Error('An account name or handle is required.')

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider,
    externalAccountId: trimmed,
    label: trimmed,
    createdBy: ctx.userId,
  })
  await recordIntegrationSuccess(connection.id)
  // recordIntegrationSuccess only updates the row - re-read so the caller
  // (and its `status`) reflects CONNECTED, not the pre-update AUTH_REQUIRED
  // `connection` still holds.
  return db.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } })
}

/** Removes a client's connection to a provider - the "X" on a connected card. */
export async function disconnectClientFromProvider(ctx: AuthContext, clientId: string, provider: IntegrationProvider) {
  assertPermission(ctx, 'integrations.manage')
  assertConnectable(provider)
  const client = await getAuthorizedClient(ctx, clientId)

  const connection = await db.integrationConnection.findFirst({
    where: { clientId: client.id, integrationAccount: { integration: { provider } } },
  })
  if (!connection) return

  await db.integrationConnection.delete({ where: { id: connection.id } })
}
