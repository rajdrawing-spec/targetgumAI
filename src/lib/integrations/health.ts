import type { IntegrationHealth, IntegrationProvider } from '@prisma/client'
import { db } from '@/lib/db/client'
import { IntegrationUnavailableError } from './errors'

/**
 * The Client -> Integration -> Integration Account -> Connection model
 * (BRD-PRD Section 33) and health tracking (Section 34). This module is
 * provider-agnostic - Metricool's usage of it lives in
 * src/lib/integrations/metricool/, but any future provider (GA4, GSC,
 * native Ads APIs) uses the same shape.
 */

/**
 * Connects a client to a specific external account (e.g. a Metricool
 * brandId) for a provider. Idempotent. New connections start
 * AUTH_REQUIRED - flipped to CONNECTED by the first successful health
 * check (recordIntegrationSuccess), never assumed connected just because a
 * row exists.
 */
export async function connectClientToProviderAccount(params: {
  organizationId: string
  clientId: string
  provider: IntegrationProvider
  externalAccountId: string
  label?: string
  createdBy: string
}) {
  const integration = await db.integration.upsert({
    where: { organizationId_provider: { organizationId: params.organizationId, provider: params.provider } },
    update: {},
    create: {
      organizationId: params.organizationId,
      provider: params.provider,
      displayName: params.provider,
    },
  })

  const account = await db.integrationAccount.upsert({
    where: {
      integrationId_externalAccountId: {
        integrationId: integration.id,
        externalAccountId: params.externalAccountId,
      },
    },
    update: { label: params.label },
    create: {
      integrationId: integration.id,
      organizationId: params.organizationId,
      externalAccountId: params.externalAccountId,
      label: params.label,
    },
  })

  return db.integrationConnection.upsert({
    where: {
      clientId_integrationAccountId: { clientId: params.clientId, integrationAccountId: account.id },
    },
    update: {},
    create: {
      clientId: params.clientId,
      organizationId: params.organizationId,
      integrationAccountId: account.id,
      status: 'AUTH_REQUIRED',
      createdBy: params.createdBy,
    },
  })
}

/** Finds the connection (if any) linking `clientId` to `provider`, with its external account. */
export async function getProviderConnection(clientId: string, provider: IntegrationProvider) {
  return db.integrationConnection.findFirst({
    where: { clientId, integrationAccount: { integration: { provider } } },
    include: { integrationAccount: true },
  })
}

/**
 * Resolves the connection required to call a provider on behalf of a
 * client, throwing IntegrationUnavailableError (never fabricating data,
 * BRD Section 56) if none exists or it isn't healthy enough to use.
 */
export async function requireProviderConnection(clientId: string, provider: IntegrationProvider) {
  const connection = await getProviderConnection(clientId, provider)
  if (!connection) {
    throw new IntegrationUnavailableError(provider, 'no connection configured for this client')
  }
  if (connection.status === 'DISCONNECTED' || connection.status === 'AUTH_REQUIRED') {
    throw new IntegrationUnavailableError(
      provider,
      `connection status is ${connection.status}`,
      connection.lastSuccessfulSyncAt,
    )
  }
  return connection
}

export async function recordIntegrationSuccess(connectionId: string) {
  await db.integrationConnection.update({
    where: { id: connectionId },
    data: { status: 'CONNECTED', lastSuccessfulSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
  })
}

export async function recordIntegrationFailure(
  connectionId: string,
  message: string,
  health: Extract<IntegrationHealth, 'DEGRADED' | 'ERROR' | 'AUTH_REQUIRED'> = 'ERROR',
) {
  await db.integrationConnection.update({
    where: { id: connectionId },
    data: { status: health, lastErrorAt: new Date(), lastErrorMessage: message },
  })
}

/**
 * Runs `fn` against a resolved connection, recording success/failure health
 * on the way out. This is what src/lib/integrations/metricool/tools.ts
 * wraps every provider call with - never call a provider directly from a
 * tool without going through this.
 */
export async function withIntegrationHealthTracking<T>(
  clientId: string,
  provider: IntegrationProvider,
  fn: (brandId: string) => Promise<T>,
): Promise<T> {
  const connection = await requireProviderConnection(clientId, provider)
  try {
    const result = await fn(connection.integrationAccount.externalAccountId)
    await recordIntegrationSuccess(connection.id)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown integration failure.'
    await recordIntegrationFailure(connection.id, message)
    if (error instanceof IntegrationUnavailableError) throw error
    throw new IntegrationUnavailableError(provider, message, connection.lastSuccessfulSyncAt)
  }
}
