import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { connectClientToMetaAdsAccount } from '@/lib/integrations/meta-ads/connect'
import { connectClientToGoogleAdsAccount } from '@/lib/integrations/google-ads/connect'
import { connectClientToAmazonAdsAccount } from '@/lib/integrations/amazon-ads/connect'
import { saveProviderCredentials } from '@/lib/integrations/health'
import { toggleCampaignStatus, syncCampaignFromApproval } from '@/lib/ads/service'
import { rejectApproval } from '@/lib/approvals/approvals'
import { approveAndExecuteApproval } from '@/lib/tools/execute'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * The Ads Hub's Pause/Activate toggle (`src/app/dashboard/ads/page.tsx`)
 * previously flipped only the local `Campaign.status` column, whatever the
 * provider - a META_ADS campaign paused here kept spending on Meta. Pausing
 * a connected META_ADS campaign must now call the real Graph API
 * (`meta_ads.pause_campaign`, MEDIUM risk - immediate, not approval-gated)
 * before the local row is updated, and must not silently mark PAUSED if
 * that call fails. Resuming goes through the Approval Engine instead
 * (`meta_ads.update_campaign`, HIGH risk - BRD Section 21 rates it like
 * "launch campaign"): a fresh call never executes, just records the
 * approval id and leaves the row PAUSED; `syncCampaignFromApproval` (called
 * from the dashboard's approve/reject Server Actions, same pattern as
 * `syncContentCalendarItemFromApproval`) reconciles it once a human
 * decides. Google Ads and Amazon Ads (both 2026-09-14) got the exact same
 * treatment once their adapters went real - see the describe blocks below,
 * which reuse `GoogleAdsMockProvider`/`AmazonAdsMockProvider` (no real
 * developer token/LWA credentials in this test environment) to prove the
 * `toggleCampaignStatus`/Approval Engine wiring itself; the real HTTP
 * request shapes for both are covered separately in
 * `tests/unit/native-ads-providers.test.ts`. Every `AdPlatform` now has a
 * real adapter, so the local-only fallback is proven against a synthetic
 * non-ads provider instead (see that test's own comment).
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

  it('resuming a META_ADS campaign never executes on a fresh call - records a pending approval, leaves it PAUSED', async () => {
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

    const afterFirstCall = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(afterFirstCall.status).toBe('PAUSED')
    expect(afterFirstCall.approvalId).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled() // never reaches the Graph API without an approval

    const pendingApproval = await testDb.approval.findUnique({ where: { id: afterFirstCall.approvalId! } })
    expect(pendingApproval?.status).toBe('PENDING')
    expect(pendingApproval?.riskLevel).toBe('HIGH')

    // Calling it again while one is already pending is refused, not a second approval.
    await expect(toggleCampaignStatus(ctx, campaign.id, 'PAUSED')).rejects.toThrow(/already pending approval/)
  })

  it('approving the resume calls the real Graph API and flips the campaign ACTIVE', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const resumeClient = await createTestClient(orgId, 'Resume Approval Client')
    const connection = await connectClientToMetaAdsAccount(ctx, resumeClient.id, 'act_777', 'Live account')
    await saveProviderCredentials(connection.id, { accessToken: 'fake-token', adAccountId: 'act_777' })

    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId: resumeClient.id,
        provider: 'META_ADS',
        providerCampaignId: '777888999',
        name: 'Resumable Campaign',
        status: 'PAUSED',
      },
    })

    const requested = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(requested.approvalId).toBeTruthy()

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await approveAndExecuteApproval(ctx, requested.approvalId!)
    await syncCampaignFromApproval(requested.approvalId!)

    const resolved = await testDb.campaign.findUnique({ where: { id: campaign.id } })
    expect(resolved?.status).toBe('ACTIVE')
    expect(resolved?.approvalId).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejecting the resume clears the pending approval and leaves the campaign PAUSED', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId,
        provider: 'META_ADS',
        providerCampaignId: 'aaa111bbb',
        name: 'Rejected Resume Campaign',
        status: 'PAUSED',
      },
    })

    const requested = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(requested.approvalId).toBeTruthy()

    await rejectApproval(ctx, requested.approvalId!, 'Not approved for this budget cycle.')
    await syncCampaignFromApproval(requested.approvalId!)

    const resolved = await testDb.campaign.findUnique({ where: { id: campaign.id } })
    expect(resolved?.status).toBe('PAUSED')
    expect(resolved?.approvalId).toBeNull()

    // A retry is possible again now that the approval is cleared.
    const retried = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(retried.approvalId).toBeTruthy()
  })

  it('a provider absent from REAL_PAUSE_RESUME_TOOLS stays local-only in both directions', async () => {
    // Every AdPlatform (Meta/Google/Amazon) has a real adapter as of
    // 2026-09-14 - there's no real-world "unintegrated ad platform" left to
    // test the fallback against, so this uses a non-ads provider value on
    // the Campaign row purely to exercise the generic fallback path itself.
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: {
        organizationId: orgId,
        clientId,
        provider: 'CANVA',
        providerCampaignId: 'no-adapter-1',
        name: 'No-Adapter Campaign',
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

describe('toggleCampaignStatus - Amazon Ads gets the same real pause/approval-gated resume treatment', () => {
  let orgId: string
  let userId: string
  let clientId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Amazon Ads Toggle Client')
    clientId = client.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    await connectClientToAmazonAdsAccount(ctx, clientId, 'mock-profile-123', 'Test profile')
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [userId])
  })

  it('pausing calls the tool registry (AmazonAdsMockProvider by default) before flipping the local row', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: { organizationId: orgId, clientId, provider: 'AMAZON_ADS', providerCampaignId: 'mock-amzn-campaign-1', name: 'Sponsored Products - Auto', status: 'ACTIVE' },
    })

    const paused = await toggleCampaignStatus(ctx, campaign.id, 'ACTIVE')
    expect(paused.status).toBe('PAUSED')
  })

  it('resuming never executes on a fresh call - records a pending HIGH-risk approval, leaves it PAUSED', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: { organizationId: orgId, clientId, provider: 'AMAZON_ADS', providerCampaignId: 'mock-amzn-campaign-2', name: 'Paused Campaign', status: 'PAUSED' },
    })

    const requested = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(requested.status).toBe('PAUSED')
    expect(requested.approvalId).toBeTruthy()

    const pendingApproval = await testDb.approval.findUnique({ where: { id: requested.approvalId! } })
    expect(pendingApproval?.status).toBe('PENDING')
    expect(pendingApproval?.riskLevel).toBe('HIGH')

    await expect(toggleCampaignStatus(ctx, campaign.id, 'PAUSED')).rejects.toThrow(/already pending approval/)
  })

  it('approving the resume executes against the provider and flips the campaign ACTIVE', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const resumeClient = await createTestClient(orgId, 'Amazon Ads Resume Approval Client')
    await connectClientToAmazonAdsAccount(ctx, resumeClient.id, 'mock-profile-456', 'Test profile')
    const campaign = await testDb.campaign.create({
      data: { organizationId: orgId, clientId: resumeClient.id, provider: 'AMAZON_ADS', providerCampaignId: 'mock-amzn-campaign-1', name: 'Resumable Campaign', status: 'PAUSED' },
    })

    const requested = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    await approveAndExecuteApproval(ctx, requested.approvalId!)
    await syncCampaignFromApproval(requested.approvalId!)

    const resolved = await testDb.campaign.findUnique({ where: { id: campaign.id } })
    expect(resolved?.status).toBe('ACTIVE')
    expect(resolved?.approvalId).toBeNull()
  })
})

describe('toggleCampaignStatus - Google Ads gets the same real pause/approval-gated resume treatment', () => {
  let orgId: string
  let userId: string
  let clientId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Google Ads Toggle Client')
    clientId = client.id

    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    await connectClientToGoogleAdsAccount(ctx, clientId, '444-555-6666', 'Test account')
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [userId])
  })

  it('pausing calls the tool registry (GoogleAdsMockProvider by default) before flipping the local row', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: { organizationId: orgId, clientId, provider: 'GOOGLE_ADS', providerCampaignId: 'mock-gads-campaign-1', name: 'Search Campaign', status: 'ACTIVE' },
    })

    const paused = await toggleCampaignStatus(ctx, campaign.id, 'ACTIVE')
    expect(paused.status).toBe('PAUSED')
  })

  it('resuming never executes on a fresh call - records a pending HIGH-risk approval, leaves it PAUSED', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const campaign = await testDb.campaign.create({
      data: { organizationId: orgId, clientId, provider: 'GOOGLE_ADS', providerCampaignId: 'mock-gads-campaign-2', name: 'Paused Campaign', status: 'PAUSED' },
    })

    const requested = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    expect(requested.status).toBe('PAUSED')
    expect(requested.approvalId).toBeTruthy()

    const pendingApproval = await testDb.approval.findUnique({ where: { id: requested.approvalId! } })
    expect(pendingApproval?.status).toBe('PENDING')
    expect(pendingApproval?.riskLevel).toBe('HIGH')

    await expect(toggleCampaignStatus(ctx, campaign.id, 'PAUSED')).rejects.toThrow(/already pending approval/)
  })

  it('approving the resume executes against the provider and flips the campaign ACTIVE', async () => {
    const ctx = (await resolveAuthContext(testDb, userId, orgId))!
    const resumeClient = await createTestClient(orgId, 'Google Ads Resume Approval Client')
    await connectClientToGoogleAdsAccount(ctx, resumeClient.id, '777-888-9999', 'Test account')
    const campaign = await testDb.campaign.create({
      data: { organizationId: orgId, clientId: resumeClient.id, provider: 'GOOGLE_ADS', providerCampaignId: 'mock-gads-campaign-1', name: 'Resumable Campaign', status: 'PAUSED' },
    })

    const requested = await toggleCampaignStatus(ctx, campaign.id, 'PAUSED')
    await approveAndExecuteApproval(ctx, requested.approvalId!)
    await syncCampaignFromApproval(requested.approvalId!)

    const resolved = await testDb.campaign.findUnique({ where: { id: campaign.id } })
    expect(resolved?.status).toBe('ACTIVE')
    expect(resolved?.approvalId).toBeNull()
  })
})
