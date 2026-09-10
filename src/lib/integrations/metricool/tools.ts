import { z } from 'zod'
import { withIntegrationHealthTracking } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { getMetricoolProvider } from './index'

/**
 * Registers Metricool as Tool Registry entries (BRD-PRD Section 13's own
 * example list: metricool.get_posts, metricool.schedule_post,
 * metricool.get_social_analytics, metricool.get_ad_campaigns,
 * metricool.get_ad_performance). `metricool.update_ad_campaign` from that
 * same example list is deliberately NOT registered - Metricool has no ads
 * write endpoint at all (docs/INTEGRATIONS.md); registering a tool with no
 * working implementation would violate "do not assume unsupported
 * operations" (BRD Section 15/116).
 *
 * Every tool resolves its target client's Metricool brand via
 * withIntegrationHealthTracking(ctx.clientId, ...) - never accepts a
 * brandId directly from the caller, so a tool call can't be pointed at a
 * brand outside the authorized client's connection.
 *
 * Call registerMetricoolTools() once at startup (idempotent).
 */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('Metricool tools require a target client (ctx.clientId).')
  return ctx.clientId
}

const DateRangeInput = z.object({ from: z.string(), to: z.string() })

const ConnectedNetworkSchema = z.object({ network: z.string(), externalId: z.string(), label: z.string().optional() })

const SocialPostRecordSchema = z.object({
  providerPostId: z.string(),
  networks: z.array(z.string()),
  text: z.string(),
  status: z.string(),
  scheduledAt: z.string().optional(),
  publishedAt: z.string().optional(),
})

const SocialMetricValueSchema = z.object({
  source: z.string(),
  retrievedAt: z.string(),
  period: z.string(),
  reach: z.number().optional(),
  impressions: z.number().optional(),
  engagement: z.number().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  shares: z.number().optional(),
  saves: z.number().optional(),
  clicks: z.number().optional(),
  followers: z.number().optional(),
  videoViews: z.number().optional(),
  watchTimeSeconds: z.number().optional(),
  raw: z.unknown(),
})

const AdCampaignRecordSchema = z.object({
  providerCampaignId: z.string(),
  name: z.string(),
  channel: z.string(),
  status: z.string().optional(),
  budget: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const AdCampaignPerformanceSchema = z.object({
  source: z.string(),
  retrievedAt: z.string(),
  period: z.string(),
  providerCampaignId: z.string(),
  spend: z.number().optional(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  ctr: z.number().optional(),
  cpc: z.number().optional(),
  cpm: z.number().optional(),
  conversions: z.number().optional(),
  conversionRate: z.number().optional(),
  cpa: z.number().optional(),
  roas: z.number().optional(),
  revenue: z.number().optional(),
  frequency: z.number().optional(),
  reach: z.number().optional(),
  raw: z.unknown(),
})

export async function registerMetricoolTools(): Promise<void> {
  await registerTool({
    key: 'metricool.get_connected_networks',
    name: 'Get connected social networks',
    provider: 'metricool',
    description: "Lists the social networks connected to a client's Metricool brand.",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({}),
    outputSchema: z.array(ConnectedNetworkSchema),
    execute: async (_input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'METRICOOL', (brandId) =>
        getMetricoolProvider().getConnectedNetworks(brandId),
      )
    },
  })

  await registerTool({
    key: 'metricool.get_posts',
    name: 'Get scheduled social posts',
    provider: 'metricool',
    description: "Lists a client's scheduled (not yet published) social posts in a date range.",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: DateRangeInput,
    outputSchema: z.array(SocialPostRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'METRICOOL', (brandId) =>
        getMetricoolProvider().getPosts(brandId, input),
      )
    },
  })

  await registerTool({
    key: 'metricool.schedule_post',
    name: 'Schedule a social post (draft)',
    provider: 'metricool',
    description:
      'Prepares a scheduled social post as a draft in Metricool. Never auto-publishes - see docs/DECISIONS.md.',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({
      networks: z.array(z.string()).min(1),
      text: z.string(),
      mediaUrls: z.array(z.string()).optional(),
      scheduledAt: z.string(),
    }),
    outputSchema: SocialPostRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'METRICOOL', (brandId) =>
        getMetricoolProvider().schedulePost({ brandId, ...input }),
      )
    },
  })

  await registerTool({
    key: 'metricool.get_social_analytics',
    name: 'Get social analytics',
    provider: 'metricool',
    description: "Reads a client's social network analytics for a date range.",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ network: z.string(), from: z.string(), to: z.string() }),
    outputSchema: z.array(SocialMetricValueSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'METRICOOL', (brandId) =>
        getMetricoolProvider().getAnalytics(brandId, input.network, input),
      )
    },
  })

  await registerTool({
    key: 'metricool.get_ad_campaigns',
    name: 'Get ad campaigns',
    provider: 'metricool',
    description: "Lists a client's ad campaigns for a channel (read-only - see docs/INTEGRATIONS.md).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ channel: z.string() }),
    outputSchema: z.array(AdCampaignRecordSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      const provider = getMetricoolProvider()
      if (!provider.getCampaigns) throw new Error('Configured Metricool provider has no getCampaigns implementation.')
      return withIntegrationHealthTracking(clientId, 'METRICOOL', (brandId) =>
        provider.getCampaigns!(brandId, input.channel),
      )
    },
  })

  await registerTool({
    key: 'metricool.get_ad_performance',
    name: 'Get ad campaign performance',
    provider: 'metricool',
    description: "Reads a client's ad campaign performance for a channel and date range (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ channel: z.string(), from: z.string(), to: z.string() }),
    outputSchema: z.array(AdCampaignPerformanceSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      const provider = getMetricoolProvider()
      if (!provider.getCampaignPerformance) {
        throw new Error('Configured Metricool provider has no getCampaignPerformance implementation.')
      }
      return withIntegrationHealthTracking(clientId, 'METRICOOL', (brandId) =>
        provider.getCampaignPerformance!(brandId, input.channel, input),
      )
    },
  })
}
