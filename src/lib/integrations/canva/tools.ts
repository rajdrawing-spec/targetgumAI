import { z } from 'zod'
import { withIntegrationHealthTracking } from '@/lib/integrations/health'
import { registerTool } from '@/lib/tools/registry'
import type { ToolContext } from '@/lib/tools/types'
import { resolveCanvaProvider } from './index'

/**
 * Registers the Canva integration as Tool Registry entries (BRD Section 17's
 * operation list: create/edit/search designs, search assets, export).
 *
 * Risk classification (BRD Section 21): `search_designs`/`search_assets`
 * are LOW (read-only, gated on the existing `clients.read`).
 * `create_design`/`edit_design`/`export_design` are MEDIUM - BRD Section
 * 21's MEDIUM examples list "Generate creative" explicitly, distinct from
 * "Publish content" (HIGH) - a Canva design is never customer-facing by
 * itself, it's a draft asset a human reviews before it goes anywhere.
 * Gated on the new `creative.manage` permission (granted to
 * `account_manager` and `marketing_employee`, matching BRD 4.2/4.3's
 * "Generate creative briefs"/"Generate content" - see
 * `src/lib/rbac/permissions.ts`).
 *
 * Every tool resolves its target client's connected Canva brand id via
 * `withIntegrationHealthTracking(ctx.clientId, 'CANVA', ...)` - never
 * accepts one directly from the caller.
 *
 * Call registerCanvaTools() once at startup (idempotent).
 */

function requireClientId(ctx: ToolContext): string {
  if (!ctx.clientId) throw new Error('Canva tools require a target client (ctx.clientId).')
  return ctx.clientId
}

const CreativeDesignRecordSchema = z.object({
  providerDesignId: z.string(),
  designUrl: z.string(),
  exportUrl: z.string().optional(),
  status: z.string(),
  thumbnailUrl: z.string().optional(),
})

const CreativeSearchResultSchema = z.object({
  providerAssetId: z.string(),
  title: z.string(),
  thumbnailUrl: z.string().optional(),
})

export async function registerCanvaTools(): Promise<void> {
  await registerTool({
    key: 'canva.create_design',
    name: 'Create a Canva design',
    provider: 'canva',
    description: 'Creates a new Canva design from a creative concept, copy, and target platform.',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['creative.manage'],
    inputSchema: z.object({ title: z.string(), concept: z.string(), copy: z.string().optional(), platform: z.string() }),
    outputSchema: CreativeDesignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'CANVA', (connection) =>
        resolveCanvaProvider().createDesign(connection.integrationAccount.externalAccountId, input),
      )
    },
  })

  await registerTool({
    key: 'canva.edit_design',
    name: 'Edit a Canva design',
    provider: 'canva',
    description: "Edits an existing Canva design's concept/copy/platform.",
    riskLevel: 'MEDIUM',
    requiredPermissions: ['creative.manage'],
    inputSchema: z.object({
      providerDesignId: z.string(),
      title: z.string().optional(),
      concept: z.string().optional(),
      copy: z.string().optional(),
      platform: z.string().optional(),
    }),
    outputSchema: CreativeDesignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      const { providerDesignId, ...changes } = input
      return withIntegrationHealthTracking(clientId, 'CANVA', () => resolveCanvaProvider().editDesign(providerDesignId, changes))
    },
  })

  await registerTool({
    key: 'canva.search_designs',
    name: 'Search Canva designs',
    provider: 'canva',
    description: "Searches a client's Canva designs by title (read-only).",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.array(CreativeSearchResultSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'CANVA', (connection) =>
        resolveCanvaProvider().searchDesigns(connection.integrationAccount.externalAccountId, input.query),
      )
    },
  })

  await registerTool({
    key: 'canva.search_assets',
    name: 'Search Canva brand assets',
    provider: 'canva',
    description: "Searches a client's Canva brand asset library (read-only - BRD Section 17's \"Access brand assets\").",
    riskLevel: 'LOW',
    requiredPermissions: ['clients.read'],
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.array(CreativeSearchResultSchema),
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'CANVA', (connection) =>
        resolveCanvaProvider().searchAssets(connection.integrationAccount.externalAccountId, input.query),
      )
    },
  })

  await registerTool({
    key: 'canva.export_design',
    name: 'Export a Canva design',
    provider: 'canva',
    description: 'Exports a Canva design to a final asset file, returning its export URL.',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['creative.manage'],
    inputSchema: z.object({ providerDesignId: z.string() }),
    outputSchema: CreativeDesignRecordSchema,
    execute: async (input, ctx) => {
      const clientId = requireClientId(ctx)
      return withIntegrationHealthTracking(clientId, 'CANVA', () => resolveCanvaProvider().exportDesign(input.providerDesignId))
    },
  })
}
