import { z } from 'zod'
import { withIntegrationHealthTracking } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { resolveGSCProvider } from './index'

/** Registers `gsc.get_search_performance` (BRD-PRD Section 13's own example list). Call once at startup (idempotent). */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('GSC tools require a target client (ctx.clientId).')
  return ctx.clientId
}

const DIMENSIONS = ['query', 'page', 'date', 'country', 'device'] as const

const SeoQueryRowSchema = z.object({
  source: z.string(),
  retrievedAt: z.string(),
  period: z.string(),
  keys: z.record(z.string(), z.string()),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
  raw: z.unknown(),
})

export async function registerGSCTools(): Promise<void> {
  await registerTool({
    key: 'gsc.get_search_performance',
    name: 'Get Search Console performance',
    provider: 'gsc',
    description:
      "Queries a client's connected Search Console property for queries/clicks/impressions/CTR/position.",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({
      dimensions: z.array(z.enum(DIMENSIONS)).min(1),
      from: z.string(),
      to: z.string(),
      rowLimit: z.number().int().positive().max(25000).optional(),
    }),
    outputSchema: z.array(SeoQueryRowSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GOOGLE_SEARCH_CONSOLE', (connection) => {
        const provider = resolveGSCProvider(connection)
        return provider.getSearchPerformance({
          siteUrl: connection.integrationAccount.externalAccountId,
          dimensions: input.dimensions,
          range: { from: input.from, to: input.to },
          rowLimit: input.rowLimit,
        })
      })
    },
  })
}
