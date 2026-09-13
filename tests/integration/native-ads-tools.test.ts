import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectClientToGoogleAdsAccount } from '@/lib/integrations/google-ads/connect'
import { registerGoogleAdsTools } from '@/lib/integrations/google-ads/tools'
import { connectClientToMetaAdsAccount } from '@/lib/integrations/meta-ads/connect'
import { registerMetaAdsTools } from '@/lib/integrations/meta-ads/tools'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { ApprovalRequiredError } from '@/lib/tools/errors'
import { approveAndExecuteApproval, executeTool } from '@/lib/tools/execute'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * Native Google Ads / Meta Ads integration (Phase 2, BRD Section 51/85) -
 * closes the "ad management (write)" gap `docs/INTEGRATIONS.md` documents
 * as confirmed unavailable via Metricool, behind the same `AdsProvider`
 * interface (BRD Section 51: "agent code is unchanged"). Both providers
 * share the exact same tool shapes/risk levels/permission model
 * (`google_ads.*`/`meta_ads.*`), so this file parametrizes the whole suite
 * across both rather than duplicating it - see docs/DECISIONS.md.
 */
describe.each([
  { label: 'Google Ads', prefix: 'google_ads', dbProvider: 'GOOGLE_ADS' as const, externalId: 'mock-gads-account-1', connect: connectClientToGoogleAdsAccount },
  { label: 'Meta Ads', prefix: 'meta_ads', dbProvider: 'META_ADS' as const, externalId: 'mock-meta-account-1', connect: connectClientToMetaAdsAccount },
])('$label tools end-to-end (Tool Registry + ads.manage + Approval Engine)', ({ prefix, dbProvider, externalId, connect }) => {
  let orgId: string
  let clientId: string
  let disconnectedClientId: string
  let superAdminId: string
  let accountManagerId: string
  let marketingEmployeeId: string
  let clientUserId: string

  beforeAll(async () => {
    await registerGoogleAdsTools()
    await registerMetaAdsTools()

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, `${prefix} E2E Client`)
    clientId = client.id
    const disconnectedClient = await createTestClient(orgId, `${prefix} Disconnected Client`)
    disconnectedClientId = disconnectedClient.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const accountManager = await createTestUser()
    accountManagerId = accountManager.id
    const amMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: accountManagerId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: amMembership.id } })
    await testDb.clientAssignment.create({ data: { clientId: disconnectedClientId, organizationUserId: amMembership.id } })

    // A second, separately-assigned employee - both hold the same
    // permissions (account_manager/marketing_employee merged into one
    // `employee` role, docs/DECISIONS.md 2026-09-13); kept as a distinct
    // user to prove ads.manage isn't somehow tied to which employee row
    // connected the account.
    const marketingEmployee = await createTestUser()
    marketingEmployeeId = marketingEmployee.id
    const meMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: marketingEmployeeId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: meMembership.id } })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })

    const superAdminCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    await connect(superAdminCtx!, clientId, externalId, 'E2E Mock Account')
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: { startsWith: `${prefix}.` } } } })
    await cleanupOrg(orgId, [superAdminId, accountManagerId, marketingEmployeeId, clientUserId])
  })

  it('the connect flow marks the connection CONNECTED (verified against the mock provider, not assumed)', async () => {
    const connection = await db.integrationConnection.findFirst({
      where: { clientId, integrationAccount: { integration: { provider: dbProvider } } },
    })
    expect(connection?.status).toBe('CONNECTED')
  })

  it('reads (get_campaigns/get_campaign_performance/get_ad_groups/get_ads) work for any role holding clients.read - even a client', async () => {
    const ctx = await resolveAuthContext(testDb, clientUserId, orgId)

    const campaigns = (await executeTool({
      ctx: ctx!,
      toolKey: `${prefix}.get_campaigns`,
      input: {},
      clientId,
    })) as Array<{ providerCampaignId: string; channel: string }>
    expect(campaigns.length).toBeGreaterThan(0)

    const performance = (await executeTool({
      ctx: ctx!,
      toolKey: `${prefix}.get_campaign_performance`,
      input: { from: '2026-01-01', to: '2026-01-31' },
      clientId,
    })) as Array<{ source: string }>
    expect(performance.length).toBeGreaterThan(0)

    const adGroups = (await executeTool({
      ctx: ctx!,
      toolKey: `${prefix}.get_ad_groups`,
      input: { providerCampaignId: campaigns[0]!.providerCampaignId },
      clientId,
    })) as Array<{ providerAdGroupId: string }>
    expect(adGroups.length).toBeGreaterThan(0)

    const ads = (await executeTool({
      ctx: ctx!,
      toolKey: `${prefix}.get_ads`,
      input: { providerAdGroupId: adGroups[0]!.providerAdGroupId },
      clientId,
    })) as Array<{ providerAdId: string }>
    expect(ads.length).toBeGreaterThan(0)
  })

  it('denies reads (as IntegrationUnavailableError) rather than fabricating data for a client with no connection', async () => {
    const ctx = await resolveAuthContext(testDb, accountManagerId, orgId)
    await expect(
      executeTool({ ctx: ctx!, toolKey: `${prefix}.get_campaigns`, input: {}, clientId: disconnectedClientId }),
    ).rejects.toThrow(IntegrationUnavailableError)
  })

  it('create_campaign (MEDIUM) executes directly for an employee and always creates a PAUSED campaign', async () => {
    const ctx = await resolveAuthContext(testDb, accountManagerId, orgId)
    const campaign = (await executeTool({
      ctx: ctx!,
      toolKey: `${prefix}.create_campaign`,
      input: { name: 'New E2E Campaign', budget: 60 },
      clientId,
    })) as { status: string; providerCampaignId: string }
    expect(campaign.status).toBe('PAUSED')

    // Every employee has ads.manage now (account_manager/marketing_employee
    // merged, docs/DECISIONS.md 2026-09-13) - a second, separately-assigned
    // employee can do the same.
    const meCtx = await resolveAuthContext(testDb, marketingEmployeeId, orgId)
    const secondCampaign = (await executeTool({
      ctx: meCtx!,
      toolKey: `${prefix}.create_campaign`,
      input: { name: 'Second Employee Campaign', budget: 45 },
      clientId,
    })) as { status: string }
    expect(secondCampaign.status).toBe('PAUSED')
  })

  it('create_campaign/pause_campaign (MEDIUM) are denied for a client (no ads.manage)', async () => {
    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(
      executeTool({ ctx: clientCtx!, toolKey: `${prefix}.create_campaign`, input: { name: 'x' }, clientId }),
    ).rejects.toThrow(ForbiddenError)
    await expect(
      executeTool({ ctx: clientCtx!, toolKey: `${prefix}.pause_campaign`, input: { providerCampaignId: 'whatever' }, clientId }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('update_budget (HIGH) never executes on a fresh call - always requires approval, then actually changes the budget once approved', async () => {
    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)

    const campaign = (await executeTool({
      ctx: amCtx!,
      toolKey: `${prefix}.create_campaign`,
      input: { name: 'Budget Test Campaign', budget: 40 },
      clientId,
    })) as { providerCampaignId: string }

    let approvalId: string | undefined
    try {
      await executeTool({
        ctx: amCtx!,
        toolKey: `${prefix}.update_budget`,
        input: { providerCampaignId: campaign.providerCampaignId, budget: 999 },
        clientId,
      })
      throw new Error('Expected update_budget to require approval on a fresh call.')
    } catch (error) {
      expect(error).toBeInstanceOf(ApprovalRequiredError)
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    const executed = await approveAndExecuteApproval(amCtx!, approvalId!)
    expect(executed.status).toBe('EXECUTED')

    // Prove the tool actually ran against the provider, not just that the approval row changed.
    const campaigns = (await executeTool({
      ctx: amCtx!,
      toolKey: `${prefix}.get_campaigns`,
      input: {},
      clientId,
    })) as Array<{ providerCampaignId: string; budget?: number }>
    expect(campaigns.find((c) => c.providerCampaignId === campaign.providerCampaignId)?.budget).toBe(999)
  })

  it('update_campaign and update_bid (HIGH) are denied outright for a client (no ads.manage - never even reach the risk gate)', async () => {
    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(
      executeTool({ ctx: clientCtx!, toolKey: `${prefix}.update_campaign`, input: { providerCampaignId: 'x', name: 'y' }, clientId }),
    ).rejects.toThrow(ForbiddenError)
    await expect(
      executeTool({ ctx: clientCtx!, toolKey: `${prefix}.update_bid`, input: { providerAdId: 'x', bid: 1 }, clientId }),
    ).rejects.toThrow(ForbiddenError)
  })
})
