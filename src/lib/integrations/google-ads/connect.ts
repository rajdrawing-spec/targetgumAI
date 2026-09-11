import { getAuthorizedClient } from '@/lib/db/tenant'
import { connectClientToProviderAccount, recordIntegrationFailure, recordIntegrationSuccess } from '@/lib/integrations/health'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { resolveGoogleAdsProvider } from './index'

/**
 * Connects a client to a Google Ads customer id. Gated by
 * `integrations.manage` (BRD Section 4.1 - "Configure integrations" is
 * Super Admin), same permission Metricool's connect flow uses - who's
 * allowed to *connect* an ads account is a different question from who's
 * allowed to *manage campaigns* on one once connected (`ads.manage`,
 * checked per-tool-call, not here).
 *
 * Deliberately mirrors Metricool's `connectClientToMetricoolBrand`
 * (single-step "connect and verify") rather than GA4/GSC's multi-step OAuth
 * flow (`buildGoogleAuthUrl`/`exchangeGoogleAuthCode`,
 * `src/lib/integrations/google/oauth.ts`): that OAuth flow was built for
 * GA4/GSC but never actually wired to any route or UI in this codebase
 * either (no real Google Cloud OAuth app exists to complete it against, and
 * neither has a "Connect" button today - `docs/INTEGRATIONS.md`), so
 * replicating it here for a similarly-credential-less Google Ads connection
 * would add a second unexercised OAuth scaffold rather than a working one.
 * The verification call below still goes through `resolveGoogleAdsProvider()`
 * exactly like every other tool call, so once a real adapter/OAuth flow
 * exists, this function needs no changes - only the failure path (still
 * `UnsupportedOperationError` today, per provider.ts) changes shape.
 */
export async function connectClientToGoogleAdsAccount(
  ctx: AuthContext,
  clientId: string,
  externalAccountId: string,
  label?: string,
) {
  assertPermission(ctx, 'integrations.manage')
  await getAuthorizedClient(ctx, clientId)

  const trimmedId = externalAccountId.trim()
  if (!trimmedId) throw new Error('A Google Ads customer id is required.')

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider: 'GOOGLE_ADS',
    externalAccountId: trimmedId,
    label: label?.trim() || undefined,
    createdBy: ctx.userId,
  })

  try {
    await resolveGoogleAdsProvider().getCampaigns(trimmedId, 'google_ads')
    await recordIntegrationSuccess(connection.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Google Ads connection failure.'
    await recordIntegrationFailure(connection.id, message)
  }

  return connection
}
