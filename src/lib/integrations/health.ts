import type { IntegrationHealth, IntegrationProvider } from '@prisma/client'
import { db } from '@/lib/db/client'
import { decryptSecret, encryptSecret } from '@/lib/crypto/envelope'
import { scopedClientWhere } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
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

export type ResolvedProviderConnection = Awaited<ReturnType<typeof requireProviderConnection>>

/**
 * Runs `fn` against a resolved connection, recording success/failure health
 * on the way out. This is what src/lib/integrations/metricool/tools.ts (and
 * ga4/, gsc/) wrap every provider call with - never call a provider
 * directly from a tool without going through this. `fn` receives the full
 * connection (its `integrationAccount.externalAccountId` is a Metricool
 * brandId, GA4 property id, or GSC site URL depending on the provider; its
 * `encryptedCredentials`, via `loadProviderCredentials`, is what OAuth
 * providers like GA4/GSC need to build an authenticated client - Metricool
 * doesn't need it, since its credential is a single org-wide API key, not
 * per-connection).
 */
export async function withIntegrationHealthTracking<T>(
  clientId: string,
  provider: IntegrationProvider,
  fn: (connection: ResolvedProviderConnection) => Promise<T>,
): Promise<T> {
  const connection = await requireProviderConnection(clientId, provider)
  try {
    const result = await fn(connection)
    await recordIntegrationSuccess(connection.id)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown integration failure.'
    await recordIntegrationFailure(connection.id, message)
    if (error instanceof IntegrationUnavailableError) throw error
    throw new IntegrationUnavailableError(provider, message, connection.lastSuccessfulSyncAt)
  }
}

/**
 * Stores OAuth credentials (e.g. a Google refresh token) for a connection,
 * envelope-encrypted (src/lib/crypto/envelope.ts) - never plaintext, per
 * docs/SECURITY.md. `credentials` should be a small JSON-serializable
 * object (e.g. `{ refreshToken: "..." }`), not the raw token string, so it
 * can grow additional fields later without a shape change.
 */
export async function saveProviderCredentials(
  connectionId: string,
  credentials: Record<string, unknown>,
): Promise<void> {
  await db.integrationConnection.update({
    where: { id: connectionId },
    data: { encryptedCredentials: encryptSecret(JSON.stringify(credentials)) },
  })
}

/** Decrypts and parses credentials stored by saveProviderCredentials, or null if none are stored. */
export function loadProviderCredentials<T = Record<string, unknown>>(connection: {
  encryptedCredentials: string | null
}): T | null {
  if (!connection.encryptedCredentials) return null
  return JSON.parse(decryptSecret(connection.encryptedCredentials)) as T
}

/**
 * Org-wide integration connection listing, scoped to the caller's
 * authorized clients (Day 13/14 dashboard - "integration health", BRD
 * Section 42/34, which asks for: last successful sync, last error,
 * connected account, client, provider, health status - credential expiry
 * isn't tracked in the schema yet, so it's omitted rather than faked).
 * Never selects `encryptedCredentials` - this is a status view, not a
 * credential-reading path (see docs/SECURITY.md).
 */
export async function listIntegrationConnectionsForOrg(ctx: AuthContext) {
  assertPermission(ctx, 'clients.read')
  return db.integrationConnection.findMany({
    where: scopedClientWhere(ctx),
    select: {
      id: true,
      clientId: true,
      status: true,
      lastSuccessfulSyncAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
      client: { select: { id: true, name: true } },
      integrationAccount: {
        select: { externalAccountId: true, label: true, integration: { select: { provider: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}
