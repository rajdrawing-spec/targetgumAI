import { getAuthorizedClient } from '@/lib/db/tenant'
import {
  connectClientToProviderAccount,
  recordIntegrationFailure,
  recordIntegrationSuccess,
} from '@/lib/integrations/health'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { getMetricoolProvider } from './index'

/**
 * The onboarding step missing until Day 15: every prior day could *read*
 * Metricool data once a client was connected, but nothing in the app could
 * actually create that connection - `connectClientToProviderAccount`
 * (src/lib/integrations/health.ts) had no caller besides tests and
 * `prisma/seed.ts`. Metricool doesn't need OAuth (BRD Section 92/
 * docs/DECISIONS.md - a single org-wide API key, not per-connection
 * credentials), so unlike GA4/GSC this can be a same-request "connect and
 * verify" action rather than a multi-step OAuth flow.
 *
 * Gated by `integrations.manage` (BRD Section 4.1 - "Configure
 * integrations" is Super Admin). Verifies the brand id is real by actually
 * calling Metricool (`getConnectedNetworks`) rather than trusting
 * whatever the caller typed - the connection is marked CONNECTED only on a
 * real successful call, ERROR (with the real message) otherwise, matching
 * the "AUTH_REQUIRED until the first successful health check" invariant
 * documented on `connectClientToProviderAccount`.
 */
export async function connectClientToMetricoolBrand(
  ctx: AuthContext,
  clientId: string,
  brandId: string,
  label?: string,
) {
  assertPermission(ctx, 'integrations.manage')
  await getAuthorizedClient(ctx, clientId)

  const trimmedBrandId = brandId.trim()
  if (!trimmedBrandId) throw new Error('A Metricool brand id is required.')

  const connection = await connectClientToProviderAccount({
    organizationId: ctx.organizationId,
    clientId,
    provider: 'METRICOOL',
    externalAccountId: trimmedBrandId,
    label: label?.trim() || undefined,
    createdBy: ctx.userId,
  })

  try {
    await getMetricoolProvider().getConnectedNetworks(trimmedBrandId)
    await recordIntegrationSuccess(connection.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Metricool connection failure.'
    await recordIntegrationFailure(connection.id, message)
  }

  return connection
}
