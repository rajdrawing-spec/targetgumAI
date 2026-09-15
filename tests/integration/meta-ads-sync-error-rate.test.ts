import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { syncMetaAdAccountTelemetry } from '@/lib/integrations/meta-ads/sync'
import { connectClientToProviderAccount, saveProviderCredentials } from '@/lib/integrations/health'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Meta's App Review rejected this app's Marketing API access for a "too
 * high" Ads API error rate. Root cause: `syncMetaAdAccountTelemetry` used
 * to always try a daily-breakdown insights request spanning the account's
 * entire history (`date_preset=maximum` + `time_increment=1`) first, which
 * Meta rejects outright once an account has more than ~90 days of history
 * - a guaranteed-to-fail call on every sync (and every new connection, via
 * connect.ts), before ever falling back to a request that actually works.
 * These pin that it's gone, plus the related fix of never spending an Ads
 * API call on ARCHIVED/DELETED campaigns' insights (see docs/DECISIONS.md).
 */
describe('syncMetaAdAccountTelemetry never makes a guaranteed-to-fail Ads API call', () => {
  let orgId: string
  let clientId: string
  let userId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Meta Sync Error Rate Test Client')
    clientId = client.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    await db.campaignMetric.deleteMany({ where: { organizationId: orgId } })
    await db.campaign.deleteMany({ where: { organizationId: orgId } })
    await cleanupOrg(orgId, [userId])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests insights with a bounded window (last_90d), never date_preset=maximum with a daily breakdown - and skips ARCHIVED campaigns entirely', async () => {
    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'META_ADS',
      externalAccountId: 'act_errorratetest',
      createdBy: userId,
    })
    await saveProviderCredentials(connection.id, { accessToken: 'fake-token', adAccountId: 'act_errorratetest' })

    const calledUrls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calledUrls.push(url)

      if (url.includes('/me?fields=')) {
        return new Response(JSON.stringify({ id: 'u1', name: 'Test User' }), { status: 200 })
      }
      if (url.includes('/act_errorratetest/campaigns')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'camp_active', name: 'Active Campaign', status: 'ACTIVE' },
              { id: 'camp_archived', name: 'Old Archived Campaign', status: 'ARCHIVED' },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/act_errorratetest/insights')) {
        // No daily rows for either campaign - forces the 4b per-campaign fallback path.
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/camp_active/insights')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      // /camp_archived/insights must never be called - fail the test if it is.
      throw new Error(`Unexpected fetch to archived campaign insights: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await syncMetaAdAccountTelemetry(ctx!, clientId, undefined, undefined, connection.id)

    expect(result.syncedCampaigns).toBe(2)

    const insightsCalls = calledUrls.filter((u) => u.includes('/act_errorratetest/insights'))
    expect(insightsCalls).toHaveLength(1)
    expect(insightsCalls[0]).toContain('date_preset=last_90d')
    expect(insightsCalls[0]).not.toContain('date_preset=maximum')

    expect(calledUrls.some((u) => u.includes('/camp_active/insights'))).toBe(true)
    expect(calledUrls.some((u) => u.includes('/camp_archived/insights'))).toBe(false)

    await db.campaignMetric.deleteMany({ where: { clientId } })
    await db.campaign.deleteMany({ where: { clientId } })
  })
})
