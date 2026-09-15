import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectClientToProviderAccount, recordIntegrationFailure, recordIntegrationSuccess } from '@/lib/integrations/health'
import { mapConnectedAdProvidersByClient, mapDailyBudgetCapByClient } from '@/lib/ads/connected-providers'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * What the guided campaign wizard's platform step is allowed to offer
 * (src/app/dashboard/ads/new/page.tsx) - only platforms healthy enough to
 * actually take a real write, never one that's connected-but-broken.
 */
describe('mapConnectedAdProvidersByClient / mapDailyBudgetCapByClient', () => {
  let orgId: string
  let connectedClientId: string
  let brokenClientId: string
  let noPolicyClientId: string
  let userId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id } })

    const connectedClient = await createTestClient(orgId, 'Healthy Connections Client')
    connectedClientId = connectedClient.id
    const googleConn = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId: connectedClientId,
      provider: 'GOOGLE_ADS',
      externalAccountId: 'mock-gads-cp-test',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(googleConn.id)
    await testDb.clientPolicy.update({ where: { clientId: connectedClientId }, data: { maxDailyAdBudget: 40 } })

    const brokenClient = await createTestClient(orgId, 'Broken Connection Client')
    brokenClientId = brokenClient.id
    const metaConn = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId: brokenClientId,
      provider: 'META_ADS',
      externalAccountId: 'mock-meta-cp-test',
      createdBy: 'test',
    })
    await recordIntegrationFailure(metaConn.id, 'Token expired', 'AUTH_REQUIRED')

    noPolicyClientId = (await createTestClient(orgId, 'No Policy Cap Client')).id
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [userId])
  })

  it('only includes providers healthy enough to launch on (CONNECTED/DEGRADED), never AUTH_REQUIRED/ERROR/DISCONNECTED', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const map = await mapConnectedAdProvidersByClient(ctx!, [connectedClientId, brokenClientId, noPolicyClientId])

    expect(Array.from(map.get(connectedClientId) ?? [])).toEqual(['GOOGLE_ADS'])
    expect(map.has(brokenClientId)).toBe(false) // AUTH_REQUIRED - not usable
    expect(map.has(noPolicyClientId)).toBe(false) // no connections at all
  })

  it('returns [] for an empty clientIds array without querying anything', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const map = await mapConnectedAdProvidersByClient(ctx!, [])
    expect(map.size).toBe(0)
  })

  it('maps ClientPolicy.maxDailyAdBudget only for clients that have one set', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const map = await mapDailyBudgetCapByClient(ctx!, [connectedClientId, noPolicyClientId])

    expect(map.get(connectedClientId)).toBe(40)
    expect(map.has(noPolicyClientId)).toBe(false)
  })
})
