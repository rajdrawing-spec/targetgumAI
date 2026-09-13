import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectClientToPlaceholderAccount,
  disconnectClientFromProvider,
} from '@/lib/integrations/connections'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import { cleanupOrg, createTestClient, createTestOrg, testDb } from '../helpers/factory'

/**
 * The client Workspace's "Connections" tab (src/lib/integrations/
 * connections.ts) - structure-first, no real provider behind any of these
 * yet. The properties worth pinning: `integrations.manage` is required (no
 * lower-permission role can silently create/remove a connection), tenant
 * isolation holds (a client in another organization is unreachable even
 * with the right permission), and providers with a real connect flow
 * elsewhere (Metricool, Canva, GA4/GSC, Google Ads, Meta Ads) can never be
 * touched from here - never a way to clobber a real, credentialed
 * connection with a placeholder label.
 */
describe('security: client Connections tab (placeholder connect/disconnect)', () => {
  let orgId: string
  let otherOrgId: string
  let clientId: string
  let otherOrgClientId: string

  function ctxWith(overrides: Partial<AuthContext>): AuthContext {
    return {
      userId: 'test-user',
      organizationId: orgId,
      roleKey: 'employee',
      permissions: new Set(),
      clientAccess: { kind: 'ALL' },
      isClientUser: false,
      ...overrides,
    }
  }

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const client = await createTestClient(orgId)
    clientId = client.id

    const otherOrg = await createTestOrg()
    otherOrgId = otherOrg.id
    const otherClient = await createTestClient(otherOrgId)
    otherOrgClientId = otherClient.id
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
    await cleanupOrg(otherOrgId)
  })

  it('denies connecting without integrations.manage', async () => {
    const ctx = ctxWith({ permissions: new Set() })
    await expect(
      connectClientToPlaceholderAccount(ctx, clientId, 'FACEBOOK', 'targetgum'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('denies disconnecting without integrations.manage', async () => {
    const manager = ctxWith({ permissions: new Set(['integrations.manage']) })
    await connectClientToPlaceholderAccount(manager, clientId, 'INSTAGRAM', 'targetgum.ig')

    const noPermission = ctxWith({ permissions: new Set() })
    await expect(disconnectClientFromProvider(noPermission, clientId, 'INSTAGRAM')).rejects.toThrow(ForbiddenError)
  })

  it('never reaches across organizations, even with the right permission', async () => {
    const ctx = ctxWith({ permissions: new Set(['integrations.manage']) })
    await expect(
      connectClientToPlaceholderAccount(ctx, otherOrgClientId, 'FACEBOOK', 'someone-elses-page'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('refuses to connect a provider whose real flow lives on the Integrations tab', async () => {
    const ctx = ctxWith({ permissions: new Set(['integrations.manage']) })
    for (const provider of ['METRICOOL', 'CANVA', 'GA4', 'GOOGLE_SEARCH_CONSOLE', 'GOOGLE_ADS', 'META_ADS'] as const) {
      await expect(connectClientToPlaceholderAccount(ctx, clientId, provider, 'placeholder')).rejects.toThrow(
        /Integrations tab/,
      )
    }
  })

  it('rejects a blank label', async () => {
    const ctx = ctxWith({ permissions: new Set(['integrations.manage']) })
    await expect(connectClientToPlaceholderAccount(ctx, clientId, 'THREADS', '   ')).rejects.toThrow()
  })

  it('connects, is visible, then disconnects and is actually gone - not just marked disconnected', async () => {
    const ctx = ctxWith({ permissions: new Set(['integrations.manage']) })

    const connection = await connectClientToPlaceholderAccount(ctx, clientId, 'PINTEREST', '@targetgum')
    expect(connection.status).toBe('CONNECTED')

    const found = await testDb.integrationConnection.findFirst({
      where: { clientId, integrationAccount: { integration: { provider: 'PINTEREST' } } },
    })
    expect(found?.id).toBe(connection.id)

    await disconnectClientFromProvider(ctx, clientId, 'PINTEREST')

    const afterDisconnect = await testDb.integrationConnection.findFirst({
      where: { clientId, integrationAccount: { integration: { provider: 'PINTEREST' } } },
    })
    expect(afterDisconnect).toBeNull()
  })

  it('disconnecting a provider with no connection is a harmless no-op', async () => {
    const ctx = ctxWith({ permissions: new Set(['integrations.manage']) })
    await expect(disconnectClientFromProvider(ctx, clientId, 'BLUESKY')).resolves.toBeUndefined()
  })
})
