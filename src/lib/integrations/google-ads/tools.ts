import { z } from 'zod'
import { AdCampaignPerformanceSchema, AdCampaignRecordSchema, AdGroupRecordSchema, AdRecordSchema } from '@/lib/integrations/ads-schemas'
import { withIntegrationHealthTracking } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { resolveGoogleAdsProvider } from './index'

/**
 * Registers the native Google Ads integration as Tool Registry entries
 * (Phase 2, BRD Section 51/85 - the "ad management (write)" gap
 * `docs/INTEGRATIONS.md` documents as confirmed unavailable via Metricool).
 * Every tool resolves its target client's connected Google Ads customer id
 * via `withIntegrationHealthTracking(ctx.clientId, 'GOOGLE_ADS', ...)` -
 * never accepts one directly from the caller - same invariant as every
 * other provider's tools file.
 *
 * Risk classification (BRD Section 21, verbatim examples in parens):
 * - Reads (`get_campaigns`/`get_campaign_performance`/`get_ad_groups`/
 *   `get_ads`): LOW, gated on the existing `clients.read` every role
 *   already holds - no new permission needed, matching Metricool's
 *   `get_ad_campaigns`/`get_ad_performance`.
 * - `create_campaign` ("Create draft campaign") and `pause_campaign`
 *   (spend-reducing, not in BRD's HIGH list, kept fast/reversible rather
 *   than approval-gated): MEDIUM, gated on the new `ads.manage` permission -
 *   executes on that permission check alone, no Approval Engine gate (same
 *   pattern as `metricool.schedule_post`). `create_campaign` always creates
 *   a `PAUSED` campaign (`GoogleAdsMockProvider`'s own safety rule) -
 *   actually launching it is a separate `update_campaign` call.
 * - `update_campaign` ("Launch campaign"/"Change targeting" - a generic
 *   update can do either), `update_budget` ("Change advertising budget"),
 *   `update_bid` ("Change bids"): HIGH, gated on `ads.manage` - never
 *   execute on a fresh call, the Approval Engine gates them
 *   (`src/lib/tools/execute.ts`'s risk gate), same shape as
 *   `metricool.publish_post`.
 *
 * Call registerGoogleAdsTools() once at startup (idempotent).
 */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('Google Ads tools require a target client (ctx.clientId).')
  return ctx.clientId
}

const CHANNEL = 'google_ads'

export async function registerGoogleAdsTools(): Promise<void> {
  await registerTool({
    key: 'google_ads.get_campaigns',
    name: 'Get Google Ads campaigns',
    provider: 'google_ads',
    description: "Lists a client's Google Ads campaigns (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({}),
    outputSchema: z.array(AdCampaignRecordSchema),
    execute: async (_input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', (connection) =>
        resolveGoogleAdsProvider().getCampaigns(connection.integrationAccount.externalAccountId, CHANNEL),
      )
    },
  })

  await registerTool({
    key: 'google_ads.get_campaign_performance',
    name: 'Get Google Ads campaign performance',
    provider: 'google_ads',
    description: "Reads a client's Google Ads campaign performance for a date range (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ from: z.string(), to: z.string() }),
    outputSchema: z.array(AdCampaignPerformanceSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', (connection) =>
        resolveGoogleAdsProvider().getCampaignPerformance(connection.integrationAccount.externalAccountId, CHANNEL, input),
      )
    },
  })

  await registerTool({
    key: 'google_ads.get_ad_groups',
    name: 'Get Google Ads ad groups',
    provider: 'google_ads',
    description: "Lists a campaign's ad groups (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ providerCampaignId: z.string() }),
    outputSchema: z.array(AdGroupRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', (connection) =>
        resolveGoogleAdsProvider().getAdGroups(connection.integrationAccount.externalAccountId, input.providerCampaignId),
      )
    },
  })

  await registerTool({
    key: 'google_ads.get_ads',
    name: 'Get Google Ads ads',
    provider: 'google_ads',
    description: "Lists an ad group's ads (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ providerAdGroupId: z.string() }),
    outputSchema: z.array(AdRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', (connection) =>
        resolveGoogleAdsProvider().getAds(connection.integrationAccount.externalAccountId, input.providerAdGroupId),
      )
    },
  })

  await registerTool({
    key: 'google_ads.create_campaign',
    name: 'Create a Google Ads campaign (paused)',
    provider: 'google_ads',
    description: 'Creates a new Google Ads campaign, always paused - see docs/DECISIONS.md.',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ name: z.string(), budget: z.number().positive().optional() }),
    outputSchema: AdCampaignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', (connection) =>
        resolveGoogleAdsProvider().createCampaign(connection.integrationAccount.externalAccountId, input),
      )
    },
  })

  await registerTool({
    key: 'google_ads.pause_campaign',
    name: 'Pause a Google Ads campaign',
    provider: 'google_ads',
    description: 'Pauses a running Google Ads campaign (spend-reducing, not approval-gated).',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerCampaignId: z.string() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', async () => {
        await resolveGoogleAdsProvider().pauseCampaign(input.providerCampaignId)
        return null
      })
    },
  })

  await registerTool({
    key: 'google_ads.update_campaign',
    name: 'Update a Google Ads campaign',
    provider: 'google_ads',
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
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', () =>
        resolveGoogleAdsProvider().updateCampaign(providerCampaignId, changes),
      )
    },
  })

  await registerTool({
    key: 'google_ads.update_budget',
    name: 'Change a Google Ads campaign budget',
    provider: 'google_ads',
    description: 'Changes a campaign\'s daily budget (BRD Section 21: "Change advertising budget" is HIGH risk) - see docs/DECISIONS.md.',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerCampaignId: z.string(), budget: z.number().positive() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', async () => {
        await resolveGoogleAdsProvider().updateBudget(input.providerCampaignId, input.budget)
        return null
      })
    },
  })

  await registerTool({
    key: 'google_ads.update_bid',
    name: 'Change a Google Ads bid',
    provider: 'google_ads',
    description: 'Changes an ad\'s bid (BRD Section 21: "Change bids" is HIGH risk) - see docs/DECISIONS.md.',
    riskLevel: 'HIGH',
    requiredPermissions: ['ads.manage'],
    inputSchema: z.object({ providerAdId: z.string(), bid: z.number().positive() }),
    outputSchema: z.null(),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_ADS', async () => {
        await resolveGoogleAdsProvider().updateBid(input.providerAdId, input.bid)
        return null
      })
    },
  })
}
