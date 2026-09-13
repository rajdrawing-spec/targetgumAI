import { z } from 'zod'
import { AdCampaignPerformanceSchema, AdCampaignRecordSchema, AdGroupRecordSchema, AdRecordSchema } from '@/lib/integrations/ads-schemas'
import { withIntegrationHealthTracking, loadProviderCredentials } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { resolveMetaAdsProvider } from './index'

/**
 * Registers the native Meta Ads integration as Tool Registry entries -
 * mirrors `src/lib/integrations/google-ads/tools.ts` exactly (same risk
 * classification, same permission model, same doc comment reasoning) with
 * `meta_ads.*` keys and `META_ADS` as the connection provider. See that
 * file's doc comment for the full BRD Section 21 risk-classification
 * rationale, not repeated here.
 *
 * Call registerMetaAdsTools() once at startup (idempotent).
 */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('Meta Ads tools require a target client (ctx.clientId).')
  return ctx.clientId
}

function resolveTokenForConnection(connection: { encryptedCredentials?: string | null }): string | undefined {
  if (connection.encryptedCredentials) {
    try {
      const creds = loadProviderCredentials<{ accessToken?: string }>(connection as any)
      if (creds?.accessToken) return creds.accessToken
    } catch {}
  }
  return process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_ACCESS_TOKEN
}

const CHANNEL = 'meta_ads'

export async function registerMetaAdsTools(): Promise<void> {
  await registerTool({
    key: 'meta_ads.get_campaigns',
    name: 'Get Meta Ads campaigns',
    provider: 'meta_ads',
    description: "Lists a client's Meta Ads campaigns (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({}),
    outputSchema: z.array(AdCampaignRecordSchema),
    execute: async (_input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', (connection) =>
        resolveMetaAdsProvider(resolveTokenForConnection(connection)).getCampaigns(connection.integrationAccount.externalAccountId, CHANNEL),
      )
    },
  })

  await registerTool({
    key: 'meta_ads.get_campaign_performance',
    name: 'Get Meta Ads campaign performance',
    provider: 'meta_ads',
    description: "Reads a client's Meta Ads campaign performance for a date range (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ from: z.string(), to: z.string() }),
    outputSchema: z.array(AdCampaignPerformanceSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', (connection) =>
        resolveMetaAdsProvider(resolveTokenForConnection(connection)).getCampaignPerformance(connection.integrationAccount.externalAccountId, CHANNEL, input),
      )
    },
  })

  await registerTool({
    key: 'meta_ads.get_ad_groups',
    name: 'Get Meta Ads ad sets',
    provider: 'meta_ads',
    description: "Lists a campaign's ad sets (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ providerCampaignId: z.string() }),
    outputSchema: z.array(AdGroupRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', (connection) =>
        resolveMetaAdsProvider(resolveTokenForConnection(connection)).getAdGroups(connection.integrationAccount.externalAccountId, input.providerCampaignId),
      )
    },
  })

  await registerTool({
    key: 'meta_ads.get_ads',
    name: 'Get Meta Ads ads',
    provider: 'meta_ads',
    description: "Lists an ad set's ads (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ providerAdGroupId: z.string() }),
    outputSchema: z.array(AdRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', (connection) =>
        resolveMetaAdsProvider(resolveTokenForConnection(connection)).getAds(connection.integrationAccount.externalAccountId, input.providerAdGroupId),
      )
    },
  })

  await registerTool({
    key: 'meta_ads.create_campaign',
    name: 'Create a Meta Ads campaign (paused)',
    provider: 'meta_ads',
    description: 'Creates a new Meta Ads campaign on the Graph API, always paused - see docs/DECISIONS.md.',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ name: z.string(), budget: z.number().positive().optional() }),
    outputSchema: AdCampaignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', (connection) =>
        resolveMetaAdsProvider(resolveTokenForConnection(connection)).createCampaign(connection.integrationAccount.externalAccountId, input),
      )
    },
  })

  await registerTool({
    key: 'meta_ads.pause_campaign',
    name: 'Pause a Meta Ads campaign',
    provider: 'meta_ads',
    description: 'Pauses a running Meta Ads campaign (spend-reducing, not approval-gated).',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerCampaignId: z.string() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', async (connection) => {
        await resolveMetaAdsProvider(resolveTokenForConnection(connection)).pauseCampaign(input.providerCampaignId)
        return null
      })
    },
  })

  await registerTool({
    key: 'meta_ads.update_campaign',
    name: 'Update a Meta Ads campaign',
    provider: 'meta_ads',
    description:
      'Changes a campaign\'s status/name/targeting-adjacent fields (BRD Section 21: "Launch campaign"/"Change targeting" are HIGH risk - approval required) - see docs/DECISIONS.md.',
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
      return withIntegrationHealthTracking(clientId, 'META_ADS', (connection) =>
        resolveMetaAdsProvider(resolveTokenForConnection(connection)).updateCampaign(providerCampaignId, changes),
      )
    },
  })

  await registerTool({
    key: 'meta_ads.update_budget',
    name: 'Change a Meta Ads campaign budget',
    provider: 'meta_ads',
    description: 'Changes a campaign\'s daily budget (BRD Section 21: "Change advertising budget" is HIGH risk) - see docs/DECISIONS.md.',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerCampaignId: z.string(), budget: z.number().positive() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', async (connection) => {
        await resolveMetaAdsProvider(resolveTokenForConnection(connection)).updateBudget(input.providerCampaignId, input.budget)
        return null
      })
    },
  })

  await registerTool({
    key: 'meta_ads.update_bid',
    name: 'Change a Meta Ads bid',
    provider: 'meta_ads',
    description: 'Changes an ad\'s bid (BRD Section 21: "Change bids" is HIGH risk) - see docs/DECISIONS.md.',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerAdId: z.string(), bid: z.number().positive() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'META_ADS', async (connection) => {
        await resolveMetaAdsProvider(resolveTokenForConnection(connection)).updateBid(input.providerAdId, input.bid)
        return null
      })
    },
  })
}
