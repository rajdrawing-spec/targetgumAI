import { getAuthorizedClient } from '@/lib/db/tenant'
import { connectClientToProviderAccount, recordIntegrationFailure, recordIntegrationSuccess } from '@/lib/integrations/health'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { resolveCanvaProvider } from './index'

/**
 * Connects a client to a Canva brand/team id. Mirrors
 * `connectClientToGoogleAdsAccount` exactly (`../google-ads/connect.ts`) -
 * single-step connect-and-verify, gated on `integrations.manage`. The four
 * `IntegrationHealth` states already generically cover BRD Section 55's
 * "Canva connected / not connected / authorization expired / unavailable"
 * (`CONNECTED`/no connection at all/`AUTH_REQUIRED`/`ERROR`) - no
 * Canva-specific state machine needed.
 */
export async function connectClientToCanvaAccount(
  ctx: AuthContext,
  clientId: string,
  externalAccountId: string,
  label?: string,
) {
  assertPermission(ctx, 'integrations.manage')
  await getAuthorizedClient(ctx, clientId)

  const trimmedId = externalAccountId.trim()
  if (!trimmedId) throw new Error('A Canva brand id is required.')

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider: 'CANVA',
    externalAccountId: trimmedId,
    label: label?.trim() || undefined,
    createdBy: ctx.userId,
  })

  try {
    await resolveCanvaProvider().searchAssets(trimmedId, '')
    await recordIntegrationSuccess(connection.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Canva connection failure.'
    await recordIntegrationFailure(connection.id, message)
  }

  return connection
}
