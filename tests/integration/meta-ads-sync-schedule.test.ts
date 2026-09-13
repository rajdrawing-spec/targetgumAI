import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findMetaAdsConnectionsDueForSync } from '@/lib/integrations/meta-ads/schedule'
import { cleanupOrg, createTestClient, createTestOrg, testDb } from '../helpers/factory'

/**
 * `findMetaAdsConnectionsDueForSync` is what the cron route
 * (src/app/api/cron/meta-ads-sync/route.ts) uses to decide which Meta Ads
 * connections to refresh - see docs/DECISIONS.md, 2026-09-13. These pin the
 * cases it has to get right: never skip a connection that's actually gone
 * stale, never touch one that's fresh or that needs a human to re-auth.
 */
describe('integration: findMetaAdsConnectionsDueForSync', () => {
  let orgId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
  })

  async function createMetaAdsConnection(
    clientId: string,
    overrides: { status?: 'CONNECTED' | 'DEGRADED' | 'AUTH_REQUIRED' | 'DISCONNECTED'; lastSuccessfulSyncAt?: Date | null },
  ) {
    const integration = await testDb.integration.upsert({
      where: { organizationId_provider: { organizationId: orgId, provider: 'META_ADS' } },
      update: {},
      create: { organizationId: orgId, provider: 'META_ADS', displayName: 'Meta Ads' },
    })
    const account = await testDb.integrationAccount.create({
      data: {
        integrationId: integration.id,
        organizationId: orgId,
        externalAccountId: `act_${Math.random().toString(36).slice(2, 10)}`,
      },
    })
    return testDb.integrationConnection.create({
      data: {
        clientId,
        organizationId: orgId,
        integrationAccountId: account.id,
        status: overrides.status ?? 'CONNECTED',
        lastSuccessfulSyncAt: overrides.lastSuccessfulSyncAt ?? null,
        createdBy: 'test',
      },
    })
  }

  it('includes a connection that has never been synced', async () => {
    const client = await createTestClient(orgId)
    const conn = await createMetaAdsConnection(client.id, { lastSuccessfulSyncAt: null })

    const due = await findMetaAdsConnectionsDueForSync(60)
    expect(due.map((d) => d.connectionId)).toContain(conn.id)
  })

  it('excludes a connection synced within the interval', async () => {
    const client = await createTestClient(orgId)
    const conn = await createMetaAdsConnection(client.id, {
      lastSuccessfulSyncAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    })

    const due = await findMetaAdsConnectionsDueForSync(60)
    expect(due.map((d) => d.connectionId)).not.toContain(conn.id)
  })

  it('includes a connection last synced longer ago than the interval', async () => {
    const client = await createTestClient(orgId)
    const conn = await createMetaAdsConnection(client.id, {
      lastSuccessfulSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    })

    const due = await findMetaAdsConnectionsDueForSync(60)
    expect(due.map((d) => d.connectionId)).toContain(conn.id)
  })

  it('excludes a connection stuck AUTH_REQUIRED, however stale, since only a human re-supplying a token can fix that', async () => {
    const client = await createTestClient(orgId)
    const conn = await createMetaAdsConnection(client.id, {
      status: 'AUTH_REQUIRED',
      lastSuccessfulSyncAt: null,
    })

    const due = await findMetaAdsConnectionsDueForSync(60)
    expect(due.map((d) => d.connectionId)).not.toContain(conn.id)
  })

  it('includes a DEGRADED connection that is due - automated retries are how it recovers', async () => {
    const client = await createTestClient(orgId)
    const conn = await createMetaAdsConnection(client.id, {
      status: 'DEGRADED',
      lastSuccessfulSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    })

    const due = await findMetaAdsConnectionsDueForSync(60)
    expect(due.map((d) => d.connectionId)).toContain(conn.id)
  })

  it('excludes a DISCONNECTED connection', async () => {
    const client = await createTestClient(orgId)
    const conn = await createMetaAdsConnection(client.id, {
      status: 'DISCONNECTED',
      lastSuccessfulSyncAt: null,
    })

    const due = await findMetaAdsConnectionsDueForSync(60)
    expect(due.map((d) => d.connectionId)).not.toContain(conn.id)
  })
})
