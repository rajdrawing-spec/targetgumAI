import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GET, maxDuration } from '@/app/api/cron/meta-ads-sync/route'
import { cleanupOrg, createTestClient, createTestOrg, testDb } from '../helpers/factory'

/**
 * `maxDuration` on this route drifting above Vercel Hobby's real 60s cap
 * silently broke deployment (Vercel rejects the deploy outright when a
 * function's `maxDuration` exceeds the plan's limit) - this shipped at
 * 300 until 2026-09-15, meaning Meta Ads sync simply never ran on a
 * Hobby-plan deployment. Fixed by pinning it to 60 and cutting the sync
 * loop short (with a time budget, `deferred` in the response) rather than
 * ever risking the hard timeout mid-request - see docs/DECISIONS.md.
 */
describe('GET /api/cron/meta-ads-sync', () => {
  let orgId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function createMetaAdsConnection(clientId: string) {
    const integration = await testDb.integration.upsert({
      where: { organizationId_provider: { organizationId: orgId, provider: 'META_ADS' } },
      update: {},
      create: { organizationId: orgId, provider: 'META_ADS', displayName: 'Meta Ads' },
    })
    const account = await testDb.integrationAccount.create({
      data: { integrationId: integration.id, organizationId: orgId, externalAccountId: `act_${Math.random().toString(36).slice(2, 10)}` },
    })
    return testDb.integrationConnection.create({
      data: { clientId, organizationId: orgId, integrationAccountId: account.id, status: 'CONNECTED', lastSuccessfulSyncAt: null, createdBy: 'test' },
    })
  }

  it('pins maxDuration to Vercel Hobby plan\'s real 60s cap', () => {
    expect(maxDuration).toBe(60)
  })

  it('rejects a request with no or a wrong CRON_SECRET', async () => {
    const noAuth = await GET(new Request('http://localhost/api/cron/meta-ads-sync'))
    expect(noAuth.status).toBe(401)

    const wrongAuth = await GET(new Request('http://localhost/api/cron/meta-ads-sync', { headers: { authorization: 'Bearer wrong-secret' } }))
    expect(wrongAuth.status).toBe(401)
  })

  it('stops processing once the time budget is exceeded, deferring the rest to the next run rather than risking the hard 60s timeout', async () => {
    const secret = process.env.CRON_SECRET
    if (!secret) throw new Error('CRON_SECRET must be set for this test (see .env.local).')

    const clientA = await createTestClient(orgId, 'Deferred Sync Client A')
    const clientB = await createTestClient(orgId, 'Deferred Sync Client B')
    await createMetaAdsConnection(clientA.id)
    await createMetaAdsConnection(clientB.id)
    // Neither client has an employee assigned, so both hit the cheap
    // "skip, no automation actor" path - no real Meta network calls needed
    // to prove the time-budget cutoff itself.

    let call = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      call += 1
      // 1: route's startedAt. 2: findMetaAdsConnectionsDueForSync's own
      // cutoff computation. 3: the first loop iteration's budget check -
      // all within budget. Everything after: budget blown.
      if (call <= 3) return 0
      return 999_999_999
    })

    const res = await GET(new Request('http://localhost/api/cron/meta-ads-sync', { headers: { authorization: `Bearer ${secret}` } }))
    const body = await res.json()

    expect(body.due).toBe(2)
    expect(body.skipped).toBe(1)
    expect(body.deferred).toBe(1)
    expect(body.synced).toBe(0)
    expect(body.failed).toBe(0)

    await testDb.integrationConnection.deleteMany({ where: { organizationId: orgId } })
  })
})
