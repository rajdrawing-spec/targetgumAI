import { getAuthorizedClient } from '@/lib/db/tenant'
import { connectClientToProviderAccount, recordIntegrationFailure, recordIntegrationSuccess } from '@/lib/integrations/health'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { resolveAmazonAdsProvider } from './index'

/**
 * Connects a client to an Amazon Ads advertiser profile id. Gated by
 * `integrations.manage`, same permission every other provider's connect
 * flow uses - who's allowed to *connect* an ads account is a different
 * question from who's allowed to *manage campaigns* on one once connected
 * (`ads.manage`, checked per-tool-call, not here).
 *
 * Single-step connect-and-verify, same shape as `connectClientToGoogleAdsAccount`
 * (agency-wide credentials, no per-connection OAuth token to collect here -
 * see amazon-ads-client.ts's header comment on the auth model). The
 * verification call goes through `resolveAmazonAdsProvider()` exactly like
 * every other tool call, so it correctly reports AUTH_REQUIRED/ERROR
 * against the real adapter once `AMAZON_ADS_CLIENT_ID` is configured but
 * the profile id is wrong or not shared with the agency's Amazon account -
 * it only "succeeds for free" today because `AmazonAdsMockProvider` always
 * does.
 */
export async function connectClientToAmazonAdsAccount(ctx: AuthContext, clientId: string, externalAccountId: string, label?: string) {
  assertPermission(ctx, 'integrations.manage')
  await getAuthorizedClient(ctx, clientId)

  const trimmedId = externalAccountId.trim()
  if (!trimmedId) throw new Error('An Amazon Ads advertiser profile id is required.')

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider: 'AMAZON_ADS',
    externalAccountId: trimmedId,
    label: label?.trim() || undefined,
    createdBy: ctx.userId,
  })

  try {
    await resolveAmazonAdsProvider().getCampaigns(trimmedId, 'amazon_ads')
    await recordIntegrationSuccess(connection.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Amazon Ads connection failure.'
    await recordIntegrationFailure(connection.id, message)
  }

  return connection
}
