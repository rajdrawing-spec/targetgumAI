import type { CreativeStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient, scopedClientWhere } from '@/lib/db/tenant'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import { executeTool } from '@/lib/tools/execute'

/**
 * Creative asset persistence + lifecycle (BRD-PRD Section 67, Phase 2
 * Section 85's Canva creative workflow). Lifecycle:
 *
 *   DRAFT -> IN_REVIEW -> APPROVED
 *                      \-> REJECTED
 *
 * Simpler than `ContentCalendarItem`'s lifecycle - no `SCHEDULED`/
 * `PUBLISHED`/`CANCELLED` states, since a `CreativeAsset` doesn't get
 * scheduled or published itself. Once `APPROVED`, the natural next step
 * (BRD Section 47's "...→ Approval → Metricool scheduling") is attaching
 * it to a `ContentCalendarItem` via that item's existing (previously
 * unused) `creativeAssetId` field, which then goes through its own
 * already-built SCHEDULED/PUBLISHED lifecycle - a human picks the
 * approved creative when creating a content item, this module doesn't
 * auto-create one (same "no new automatic wiring" discipline as the
 * competitor-analysis phase - see docs/DECISIONS.md).
 *
 * `persistCreativeAssetsFromBrief` is what `src/lib/workflows/
 * creative-workflow.ts` calls after the Creative Agent generates concepts
 * - mirrors `recommendations/persist.ts`'s `persistRecommendations`
 * exactly (client-access check only, no separate permission check - the
 * caller already gated on `analysis.trigger`).
 *
 * `generateCreativeDesign` (DRAFT/IN_REVIEW, unchanged status -> same
 * status, now with a design attached) calls `canva.create_design`
 * (MEDIUM risk - executes directly, no Approval Engine gate) through
 * `executeTool`, same as every other tool call. BRD Section 121: "If
 * Canva is unavailable, fail gracefully and preserve the creative brief" -
 * a failure here propagates to the caller but never touches the
 * `CreativeAsset` row, so the brief (concept/copy) is always preserved
 * regardless of whether a design could be generated.
 */

export interface CreativeAssetInput {
  platform?: string
  campaignId?: string
  concept?: string
  copy?: string
}

async function getOwnedCreativeAsset(ctx: AuthContext, assetId: string) {
  const asset = await db.creativeAsset.findUnique({ where: { id: assetId } })
  if (!asset || asset.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this creative asset.')
  }
  const client = await db.client.findUnique({ where: { id: asset.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this creative asset.')
  assertClientAccess(ctx, client)
  return asset
}

/** Persists a batch of creative concepts from one AI run as DRAFT CreativeAsset rows - no separate permission check, mirrors persistRecommendations (the caller, the creative workflow, already gated on analysis.trigger). */
export async function persistCreativeAssetsFromBrief(
  ctx: AuthContext,
  clientId: string,
  createdBy: string,
  platform: string,
  concepts: Array<{ title: string; copy: string; visualDescription: string; brandAligned: boolean; brandNotes?: string }>,
) {
  await getAuthorizedClient(ctx, clientId)
  return Promise.all(
    concepts.map((concept) =>
      db.creativeAsset.create({
        data: {
          organizationId: ctx.organizationId,
          clientId,
          platform,
          concept: concept.visualDescription,
          copy: `${concept.title}\n\n${concept.copy}${concept.brandAligned ? '' : `\n\n[Brand note: ${concept.brandNotes ?? 'flagged as not brand-aligned'}]`}`,
          status: 'DRAFT',
          createdBy,
        },
      }),
    ),
  )
}

export async function listCreativeAssets(ctx: AuthContext, clientId: string, filter: { status?: CreativeStatus } = {}) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.creativeAsset.findMany({
    where: { clientId, ...(filter.status && { status: filter.status }) },
    orderBy: { createdAt: 'desc' },
  })
}

/** Org-wide listing, scoped to the caller's authorized clients - mirrors listContentCalendarItemsForOrg. */
export async function listCreativeAssetsForOrg(ctx: AuthContext, filter: { status?: CreativeStatus; clientId?: string; limit?: number } = {}) {
  assertPermission(ctx, 'clients.read')
  return db.creativeAsset.findMany({
    where: { ...scopedClientWhere(ctx), ...(filter.status && { status: filter.status }), ...(filter.clientId && { clientId: filter.clientId }) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
  })
}

export async function getCreativeAsset(ctx: AuthContext, assetId: string) {
  assertPermission(ctx, 'clients.read')
  return getOwnedCreativeAsset(ctx, assetId)
}

export async function submitCreativeForReview(ctx: AuthContext, assetId: string) {
  assertPermission(ctx, 'creative.manage')
  const asset = await getOwnedCreativeAsset(ctx, assetId)
  if (asset.status !== 'DRAFT') {
    throw new Error(`Cannot submit a creative asset in status ${asset.status} for review.`)
  }
  return db.creativeAsset.update({ where: { id: assetId }, data: { status: 'IN_REVIEW' } })
}

export async function approveCreativeAsset(ctx: AuthContext, assetId: string) {
  assertPermission(ctx, 'creative.manage')
  const asset = await getOwnedCreativeAsset(ctx, assetId)
  if (asset.status !== 'IN_REVIEW') {
    throw new Error(`Cannot approve a creative asset in status ${asset.status}.`)
  }
  return db.creativeAsset.update({ where: { id: assetId }, data: { status: 'APPROVED' } })
}

export async function rejectCreativeAsset(ctx: AuthContext, assetId: string) {
  assertPermission(ctx, 'creative.manage')
  const asset = await getOwnedCreativeAsset(ctx, assetId)
  if (asset.status !== 'IN_REVIEW') {
    throw new Error(`Cannot reject a creative asset in status ${asset.status}.`)
  }
  return db.creativeAsset.update({ where: { id: assetId }, data: { status: 'REJECTED' } })
}

/**
 * Calls the Canva mock (or real, once implemented) provider to actually
 * generate the design for an already-drafted creative asset. Leaves
 * `status` untouched either way - design generation isn't a review-state
 * transition, it's attaching an artifact. On failure, the error
 * propagates to the caller but the `CreativeAsset` row is never modified -
 * see this module's top doc comment for the BRD Section 121 reasoning.
 */
export async function generateCreativeDesign(ctx: AuthContext, assetId: string) {
  assertPermission(ctx, 'creative.manage')
  const asset = await getOwnedCreativeAsset(ctx, assetId)
  if (asset.status === 'APPROVED' || asset.status === 'REJECTED') {
    throw new Error(`Cannot generate a design for a creative asset already in status ${asset.status}.`)
  }

  const result = (await executeTool({
    ctx,
    toolKey: 'canva.create_design',
    clientId: asset.clientId,
    input: {
      title: asset.copy?.split('\n')[0] || 'Untitled creative',
      concept: asset.concept ?? '',
      copy: asset.copy ?? undefined,
      platform: asset.platform ?? 'instagram',
    },
  })) as { providerDesignId: string; designUrl: string; exportUrl?: string }

  return db.creativeAsset.update({
    where: { id: assetId },
    data: { designUrl: result.designUrl, exportUrl: result.exportUrl, provider: 'canva' },
  })
}
