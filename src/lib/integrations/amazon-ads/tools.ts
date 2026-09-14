import { z } from 'zod'
import { AdCampaignPerformanceSchema, AdCampaignRecordSchema, AdGroupRecordSchema, AdRecordSchema } from '@/lib/integrations/ads-schemas'
import { withIntegrationHealthTracking } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { resolveAmazonAdsProvider } from './index'

/**
 * Registers the native Amazon Ads (Sponsored Products) integration as
 * Tool Registry entries - mirrors `src/lib/integrations/google-ads/
 * tools.ts` exactly (same risk classification, same permission model,
 * same doc comment reasoning) with `amazon_ads.*` keys and `AMAZON_ADS` as
 * the connection provider. See that file's doc comment for the full BRD
 * Section 21 risk-classification rationale, not repeated here.
 *
 * Call registerAmazonAdsTools() once at startup (idempotent).
 */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('Amazon Ads tools require a target client (ctx.clientId).')
  return ctx.clientId
}

const CHANNEL = 'amazon_ads'

export async function registerAmazonAdsTools(): Promise<void> {
  await registerTool({
    key: 'amazon_ads.get_campaigns',
    name: 'Get Amazon Ads campaigns',
    provider: 'amazon_ads',
    description: "Lists a client's Amazon Sponsored Products campaigns (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({}),
    outputSchema: z.array(AdCampaignRecordSchema),
    execute: async (_input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', (connection) =>
        resolveAmazonAdsProvider().getCampaigns(connection.integrationAccount.externalAccountId, CHANNEL),
      )
    },
  })

  await registerTool({
    key: 'amazon_ads.get_campaign_performance',
    name: 'Get Amazon Ads campaign performance',
    provider: 'amazon_ads',
    description: "Reads a client's Amazon Ads campaign performance for a date range (read-only, via Amazon's asynchronous Reporting API).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ from: z.string(), to: z.string() }),
    outputSchema: z.array(AdCampaignPerformanceSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', (connection) =>
        resolveAmazonAdsProvider().getCampaignPerformance(connection.integrationAccount.externalAccountId, CHANNEL, input),
      )
    },
  })

  await registerTool({
    key: 'amazon_ads.get_ad_groups',
    name: 'Get Amazon Ads ad groups',
    provider: 'amazon_ads',
    description: "Lists a campaign's ad groups (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ providerCampaignId: z.string() }),
    outputSchema: z.array(AdGroupRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', (connection) =>
        resolveAmazonAdsProvider().getAdGroups(connection.integrationAccount.externalAccountId, input.providerCampaignId),
      )
    },
  })

  await registerTool({
    key: 'amazon_ads.get_ads',
    name: 'Get Amazon Ads product ads',
    provider: 'amazon_ads',
    description: "Lists an ad group's product ads (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ providerAdGroupId: z.string() }),
    outputSchema: z.array(AdRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', (connection) =>
        resolveAmazonAdsProvider().getAds(connection.integrationAccount.externalAccountId, input.providerAdGroupId),
      )
    },
  })

  await registerTool({
    key: 'amazon_ads.create_campaign',
    name: 'Create an Amazon Sponsored Products campaign (paused)',
    provider: 'amazon_ads',
    description: 'Creates a new Amazon Sponsored Products campaign, always paused - see docs/DECISIONS.md.',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ name: z.string(), budget: z.number().positive().optional() }),
    outputSchema: AdCampaignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', (connection) =>
        resolveAmazonAdsProvider().createCampaign(connection.integrationAccount.externalAccountId, input),
      )
    },
  })

  await registerTool({
    key: 'amazon_ads.pause_campaign',
    name: 'Pause an Amazon Ads campaign',
    provider: 'amazon_ads',
    description: 'Pauses a running Amazon Sponsored Products campaign (spend-reducing, not approval-gated).',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerCampaignId: z.string() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', async (connection) => {
        await resolveAmazonAdsProvider(connection.integrationAccount.externalAccountId).pauseCampaign(input.providerCampaignId)
        return null
      })
    },
  })

  await registerTool({
    key: 'amazon_ads.update_campaign',
    name: 'Update an Amazon Ads campaign',
    provider: 'amazon_ads',
    description:
      'Changes a campaign\'s status/name/budget-adjacent fields (BRD Section 21: "Launch campaign"/"Change targeting" are HIGH risk - approval required) - see docs/DECISIONS.md.',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({
      providerCampaignId: z.string(),
      name: z.string().optional(),
      status: z.string().optional(),
      budget: z.number().positive().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    outputSchema: AdCampaignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      const { providerCampaignId, ...changes } = input
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', (connection) =>
        resolveAmazonAdsProvider(connection.integrationAccount.externalAccountId).updateCampaign(providerCampaignId, changes),
      )
    },
  })

  await registerTool({
    key: 'amazon_ads.update_budget',
    name: 'Change an Amazon Ads campaign budget',
    provider: 'amazon_ads',
    description: 'Changes a campaign\'s daily budget (BRD Section 21: "Change advertising budget" is HIGH risk) - see docs/DECISIONS.md.',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerCampaignId: z.string(), budget: z.number().positive() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', async (connection) => {
        await resolveAmazonAdsProvider(connection.integrationAccount.externalAccountId).updateBudget(input.providerCampaignId, input.budget)
        return null
      })
    },
  })

  await registerTool({
    key: 'amazon_ads.update_bid',
    name: 'Change an Amazon Ads default bid',
    provider: 'amazon_ads',
    description:
      'Changes an ad group\'s default bid (BRD Section 21: "Change bids" is HIGH risk) - see docs/DECISIONS.md. Amazon Ads sets bids at the ad group (or keyword) level, not per-ad, so `providerAdId` here is treated as an ad group id (amazon-ads/provider.ts).',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerAdId: z.string(), bid: z.number().positive() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'AMAZON_ADS', async (connection) => {
        await resolveAmazonAdsProvider(connection.integrationAccount.externalAccountId).updateBid(input.providerAdId, input.bid)
        return null
      })
    },
  })
}
