import { getAuthorizedClient } from '@/lib/db/tenant'
import { connectClientToProviderAccount, recordIntegrationFailure, recordIntegrationSuccess } from '@/lib/integrations/health'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { resolveMetaAdsProvider } from './index'

/**
 * Connects a client to a Meta Ads account id. Mirrors
 * `connectClientToGoogleAdsAccount` exactly (`../google-ads/connect.ts`) -
 * see that file's doc comment for why this is a single-step connect-and-
 * verify rather than a full OAuth flow.
 */
export async function connectClientToMetaAdsAccount(
  ctx: AuthContext,
  clientId: string,
  externalAccountId: string,
  label?: string,
) {
  assertPermission(ctx, 'integrations.manage')
  await getAuthorizedClient(ctx, clientId)

  const trimmedId = externalAccountId.trim()
  if (!trimmedId) throw new Error('A Meta Ads account id is required.')

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider: 'META_ADS',
    externalAccountId: trimmedId,
    label: label?.trim() || undefined,
    createdBy: ctx.userId,
  })

  try {
    await resolveMetaAdsProvider().getCampaigns(trimmedId, 'meta_ads')
    await recordIntegrationSuccess(connection.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Meta Ads connection failure.'
    await recordIntegrationFailure(connection.id, message)
  }

  return connection
}
