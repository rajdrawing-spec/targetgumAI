import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { connectClientToMetaAdsAccount } from '@/lib/integrations/meta-ads/connect'
import { saveProviderCredentials } from '@/lib/integrations/health'
import { toggleCampaignStatus } from '@/lib/ads/service'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * The Ads Hub's Pause/Activate toggle (`src/app/dashboard/ads/page.tsx`)
 * previously flipped only the local `Campaign.status` column, whatever the
 * provider - a META_ADS campaign paused here kept spending on Meta. Pausing
 * a connected META_ADS campaign must now call the real Graph API
 * (`meta_ads.pause_campaign`, MEDIUM risk - immediate, not approval-gated)
 * before the local row is updated, and must not silently mark PAUSED if
 * that call fails. Resuming stays local-only for now (BRD Section 21 rates
 * it like "launch campaign" - HIGH/approval-gated - and there's no pending-
 * approval UI on this toggle yet, docs/DECISIONS.md), as does every
 * direction for a non-Meta provider.
 */
describe('toggleCampaignStatus - pauses a connected META_ADS campaign for real', () => {
  let orgId: string
  let userId: string
  let clientId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId)
    clientId = client.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [userId])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the real Graph API pause endpoint and only then marks the local row PAUSED', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const connection = await connectClientToMetaAdsAccount(ctx, clientId, 'act_555', 'Live account')
    await saveProviderCredentials(connection.id, { accessToken: 'fake-token', adAccountId: 'act_555' })

    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId,
        provider: 'META_ADS',
        providerCampaignId: '999888777',
        name: 'Live Meta Campaign',
        status: 'ACTIVE',
      },
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      expect(url).toContain('/999888777')
      expect(init?.method).toBe('POST')
      const params = new URLSearchParams(init?.body as string)
      expect(params.get('status')).toBe('PAUSED')
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const updated = await toggleCampaignStatus(ctx, campaign.id, 'ACTIVE')
    expect(updated.status).toBe('PAUSED')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not mark the campaign PAUSED locally if the real Graph API call fails', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const disconnectedClient = await createTestClient(orgId, 'No Meta Connection')

    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId: disconnectedClient.id,
        provider: 'META_ADS',
        providerCampaignId: '111222333',
        name: 'Unconnected Campaign',
        status: 'ACTIVE',
      },
    })

    await expect(toggleCampaignStatus(ctx, campaign.id, 'ACTIVE')).rejects.toThrow()

    const stillActive = await testDb.campaign.findUnique({ where: { id: campaign.id } })
    expect(stillActive?.status).toBe('ACTIVE')
  })

  it('resuming a META_ADS campaign stays local-only (no Graph API call) - approval-gating that direction has no UI yet', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId,
        provider: 'META_ADS',
        providerCampaignId: '444555666',
        name: 'Paused Meta Campaign',
        status: 'PAUSED',
      },
    })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const updated = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(updated.status).toBe('ACTIVE')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a non-Meta provider stays local-only in both directions', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId,
        provider: 'GOOGLE_ADS',
        providerCampaignId: 'gads-1',
        name: 'Google Campaign',
        status: 'ACTIVE',
      },
    })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const paused = await toggleCampaignStatus(ctx, campaign.id, 'ACTIVE')
    expect(paused.status).toBe('PAUSED')
    const resumed = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(resumed.status).toBe('ACTIVE')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
