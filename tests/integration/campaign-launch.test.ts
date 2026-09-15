import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerGoogleAdsTools } from '@/lib/integrations/google-ads/tools'
import { connectClientToProviderAccount, recordIntegrationSuccess } from '@/lib/integrations/health'
import { launchCampaignFromWizard } from '@/lib/ads/launch'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

const AD_CONCEPT = {
  headline: 'Same-Day Birthday Cakes, Delivered',
  primaryText: 'Order a custom birthday cake and get it delivered the same day.',
  visualDirection: 'A bright photo of a decorated birthday cake.',
}

/**
 * The guided wizard's final, real step (BRD Section 109: agent code never
 * branches on provider - this goes through the exact same `executeTool` /
 * `{provider}.create_campaign` chain any other caller does). Replaces the
 * old local-only `ads/service.ts` `createCampaign`, which fabricated a
 * providerCampaignId and never touched a real ad platform - every
 * assertion here specifically checks that this version doesn't do that
 * (docs/DECISIONS.md).
 */
describe('launchCampaignFromWizard', () => {
  let orgId: string
  let clientId: string
  let staffUserId: string
  let clientPortalUserId: string
  let otherOrgId: string
  let otherOrgClientId: string
  let otherOrgUserId: string

  beforeAll(async () => {
    await registerGoogleAdsTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Campaign Launch Test Client')
    clientId = client.id

    const staff = await createTestUser()
    staffUserId = staff.id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: staffUserId, roleId: roles.get('super_admin')!.id } })

    const clientPortalUser = await createTestUser()
    clientPortalUserId = clientPortalUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientPortalUserId } })

    const connection = await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'GOOGLE_ADS',
      externalAccountId: 'mock-gads-launch-test',
      createdBy: 'test',
    })
    await recordIntegrationSuccess(connection.id)

    // A second org/client, to prove tenant isolation.
    const otherOrg = await createTestOrg()
    otherOrgId = otherOrg.id
    const otherRoles = await createSystemRoles(otherOrgId)
    const otherClient = await createTestClient(otherOrgId, 'Other Org Client')
    otherOrgClientId = otherClient.id
    const otherUser = await createTestUser()
    otherOrgUserId = otherUser.id
    await testDb.organizationUser.create({
      data: { organizationId: otherOrgId, userId: otherOrgUserId, roleId: otherRoles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    await db.creativeAsset.deleteMany({ where: { clientId: { in: [clientId, otherOrgClientId] } } })
    await db.campaign.deleteMany({ where: { clientId: { in: [clientId, otherOrgClientId] } } })
    await cleanupOrg(orgId, [staffUserId, clientPortalUserId])
    await cleanupOrg(otherOrgId, [otherOrgUserId])
  })

  it('creates a real campaign (a genuine providerCampaignId from the tool, never a fabricated one) and a linked draft ad, starting PAUSED', async () => {
    const ctx = await resolveAuthContext(testDb, staffUserId, orgId)
    const result = await launchCampaignFromWizard({
      ctx: ctx!,
      clientId,
      provider: 'GOOGLE_ADS',
      name: 'Austin Birthday Cakes - Sales',
      dailyBudget: 25,
      adConcept: AD_CONCEPT,
    })

    const campaign = await db.campaign.findUniqueOrThrow({ where: { id: result.campaignId } })
    expect(campaign.provider).toBe('GOOGLE_ADS')
    expect(campaign.name).toBe('Austin Birthday Cakes - Sales')
    expect(campaign.status).toBe('PAUSED')
    expect(Number(campaign.budget)).toBe(25)
    // Never the old fake pattern (`google_ads_<timestamp>_<random>`) - a
    // real id the mock (or real) provider actually returned.
    expect(campaign.providerCampaignId).not.toMatch(/^google_ads_\d+_/)
    expect(campaign.providerCampaignId.length).toBeGreaterThan(0)

    const creativeAsset = await db.creativeAsset.findUniqueOrThrow({ where: { id: result.creativeAssetId } })
    expect(creativeAsset.campaignId).toBe(campaign.id)
    expect(creativeAsset.status).toBe('DRAFT')
    expect(creativeAsset.copy).toContain(AD_CONCEPT.headline)
    expect(creativeAsset.copy).toContain(AD_CONCEPT.primaryText)
    expect(creativeAsset.concept).toBe(AD_CONCEPT.visualDirection)

    // Fully audited like any other real tool call.
    const execution = await db.toolExecution.findFirst({
      where: { clientId, tool: { key: 'google_ads.create_campaign' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(execution?.status).toBe('SUCCEEDED')
  })

  it('denies a client-portal user outright (no ads.manage)', async () => {
    const ctx = await resolveAuthContext(testDb, clientPortalUserId, orgId)
    await expect(
      launchCampaignFromWizard({
        ctx: ctx!,
        clientId,
        provider: 'GOOGLE_ADS',
        name: 'Should never be created',
        dailyBudget: 10,
        adConcept: AD_CONCEPT,
      }),
    ).rejects.toThrow(ForbiddenError)

    const found = await db.campaign.findFirst({ where: { name: 'Should never be created' } })
    expect(found).toBeNull()
  })

  it('denies launching for a client in another organization, even for a super_admin of that other org (tenant isolation)', async () => {
    const ctx = await resolveAuthContext(testDb, otherOrgUserId, otherOrgId)
    await expect(
      launchCampaignFromWizard({
        ctx: ctx!,
        clientId, // belongs to `orgId`, not `otherOrgId`
        provider: 'GOOGLE_ADS',
        name: 'Cross-tenant attempt',
        dailyBudget: 10,
        adConcept: AD_CONCEPT,
      }),
    ).rejects.toThrow(ForbiddenError)

    const found = await db.campaign.findFirst({ where: { name: 'Cross-tenant attempt' } })
    expect(found).toBeNull()
  })
})
