import { getAuthorizedClient } from '@/lib/db/tenant'
import {
  connectClientToProviderAccount,
  recordIntegrationFailure,
  recordIntegrationSuccess,
  saveProviderCredentials,
} from '@/lib/integrations/health'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { verifyMetaCredentials } from './meta-client'
import { syncMetaAdAccountTelemetry } from './sync'

/**
 * Connects a client to a genuine Meta Ads account id and stores encrypted
 * credentials (access token). Validates token live and initiates first sync.
 */
export async function connectClientToMetaAdsAccount(
  ctx: AuthContext,
  clientId: string,
  externalAccountId: string,
  label?: string,
  accessToken?: string,
) {
  assertPermission(ctx, 'integrations.manage')
  await getAuthorizedClient(ctx, clientId)

  const trimmedId = externalAccountId.trim()
  if (!trimmedId) throw new Error('A Meta Ads account id is required.')

  const normalizedId = trimmedId.startsWith('act_') ? trimmedId : `act_${trimmedId}`
  const token = accessToken?.trim() || process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_ACCESS_TOKEN

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider: 'META_ADS',
    externalAccountId: normalizedId,
    label: label?.trim() || undefined,
    createdBy: ctx.userId,
  })

  // If token was supplied, verify and store with envelope encryption
  if (token) {
    try {
      await verifyMetaCredentials(token)
      await saveProviderCredentials(connection.id, {
        accessToken: token,
        adAccountId: normalizedId,
      })

      // Immediate first sync to stream live campaigns and insights
      await syncMetaAdAccountTelemetry(ctx, clientId, normalizedId, token)
      await recordIntegrationSuccess(connection.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Meta Ads verification failed.'
      await recordIntegrationFailure(connection.id, message)
      throw new Error(`Meta Ads connection failed: ${message}`)
    }
  } else {
    // Registered pending credentials
    await recordIntegrationSuccess(connection.id)
  }

  return connection
}
