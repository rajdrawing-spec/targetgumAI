import { z } from 'zod'
import { withIntegrationHealthTracking } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { resolveGA4Provider } from './index'

/** Registers `ga4.get_report` (BRD-PRD Section 13's own example list). Call once at startup (idempotent). */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('GA4 tools require a target client (ctx.clientId).')
  return ctx.clientId
}

const ReportRowSchema = z.object({
  source: z.string(),
  retrievedAt: z.string(),
  period: z.string(),
  dimensions: z.record(z.string(), z.string()),
  metrics: z.record(z.string(), z.number()),
  raw: z.unknown(),
})

export async function registerGA4Tools(): Promise<void> {
  await registerTool({
    key: 'ga4.get_report',
    name: 'Get GA4 report',
    provider: 'ga4',
    description:
      "Runs a GA4 report (dimensions/metrics/date range) against a client's connected property.",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({
      dimensions: z.array(z.string()).min(1),
      metrics: z.array(z.string()).min(1),
      from: z.string(),
      to: z.string(),
    }),
    outputSchema: z.array(ReportRowSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'GA4', (connection) => {
        const provider = resolveGA4Provider(connection)
        return provider.getReport({
          propertyId: connection.integrationAccount.externalAccountId,
          dimensions: input.dimensions,
          metrics: input.metrics,
          range: { from: input.from, to: input.to },
        })
      })
    },
  })
}
