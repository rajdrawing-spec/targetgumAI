import type { ContentStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient, scopedClientWhere } from '@/lib/db/tenant'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import { executeTool } from '@/lib/tools/execute'

/**
 * Social content calendar (BRD-PRD Section 66 entities, Section 48's MVP
 * Social Scheduling flow, Section 85 Phase 2). Lifecycle:
 *
 *   IDEA -> DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED
 *                                                      \-> FAILED
 *   (any non-terminal state) -> CANCELLED
 *
 * `scheduleContentItem` is where this actually talks to a provider: it
 * calls the already-registered `metricool.schedule_post` tool (MEDIUM
 * risk per Section 21's "prepare scheduled content" - executes on a
 * `content.manage` permission check alone, no Approval Engine gate, exactly
 * like every other MEDIUM-risk tool in this codebase) through
 * `executeTool`, never the Metricool provider directly - same
 * authorization/audit chain as every other tool call. The Metricool
 * adapter's own safety rule (`src/lib/integrations/metricool/provider.ts`)
 * means this only ever creates a Metricool *draft*, never a real publish -
 * `PUBLISHED` is not reachable from this module; closing that gap is the
 * separate "Automated social scheduling" Phase 2 item (BRD Section 85),
 * its own HIGH-risk, Approval-Engine-gated tool.
 */

export interface ContentCalendarItemInput {
  platform: string
  publishDate: Date
  caption?: string
  creativeAssetId?: string
}

export async function createContentCalendarItem(
  ctx: AuthContext,
  clientId: string,
  input: ContentCalendarItemInput,
) {
  assertPermission(ctx, 'content.manage')
  await getAuthorizedClient(ctx, clientId)
  return db.contentCalendarItem.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      platform: input.platform,
      publishDate: input.publishDate,
      caption: input.caption,
      creativeAssetId: input.creativeAssetId,
      status: 'DRAFT',
      createdBy: ctx.userId,
    },
  })
}

export async function listContentCalendarItems(
  ctx: AuthContext,
  clientId: string,
  filter: { status?: ContentStatus } = {},
) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.contentCalendarItem.findMany({
    where: { clientId, ...(filter.status && { status: filter.status }) },
    orderBy: { publishDate: 'asc' },
  })
}

/** Org-wide listing, scoped to the caller's authorized clients - mirrors listRecommendationsForOrg/listTasksForOrg for a future "Content calendar" dashboard widget. */
export async function listContentCalendarItemsForOrg(
  ctx: AuthContext,
  filter: { status?: ContentStatus; limit?: number } = {},
) {
  assertPermission(ctx, 'clients.read')
  return db.contentCalendarItem.findMany({
    where: { ...scopedClientWhere(ctx), ...(filter.status && { status: filter.status }) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { publishDate: 'asc' },
    take: filter.limit ?? 50,
  })
}

async function getOwnedContentItem(ctx: AuthContext, itemId: string) {
  const item = await db.contentCalendarItem.findUnique({ where: { id: itemId } })
  if (!item || item.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this content calendar item.')
  }
  const client = await db.client.findUnique({ where: { id: item.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this content calendar item.')
  assertClientAccess(ctx, client)
  return item
}

export async function getContentCalendarItem(ctx: AuthContext, itemId: string) {
  assertPermission(ctx, 'clients.read')
  return getOwnedContentItem(ctx, itemId)
}

/** Edits an item still in IDEA/DRAFT - once it's been submitted for review, editing again means withdrawing it back to DRAFT first (BRD doesn't specify an in-place edit-while-review flow, and silently mutating something a reviewer already looked at would be misleading). */
export async function updateContentCalendarItem(
  ctx: AuthContext,
  itemId: string,
  input: Partial<ContentCalendarItemInput>,
) {
  assertPermission(ctx, 'content.manage')
  const item = await getOwnedContentItem(ctx, itemId)
  if (item.status !== 'IDEA' && item.status !== 'DRAFT') {
    throw new Error(`Cannot edit a content item in status ${item.status}.`)
  }
  return db.contentCalendarItem.update({
    where: { id: itemId },
    data: {
      platform: input.platform,
      publishDate: input.publishDate,
      caption: input.caption,
      creativeAssetId: input.creativeAssetId,
    },
  })
}

export async function submitContentForReview(ctx: AuthContext, itemId: string) {
  assertPermission(ctx, 'content.manage')
  const item = await getOwnedContentItem(ctx, itemId)
  if (item.status !== 'IDEA' && item.status !== 'DRAFT') {
    throw new Error(`Cannot submit a content item in status ${item.status} for review.`)
  }
  return db.contentCalendarItem.update({ where: { id: itemId }, data: { status: 'IN_REVIEW' } })
}

export async function approveContentCalendarItem(ctx: AuthContext, itemId: string) {
  assertPermission(ctx, 'content.manage')
  const item = await getOwnedContentItem(ctx, itemId)
  if (item.status !== 'IN_REVIEW') {
    throw new Error(`Cannot approve a content item in status ${item.status}.`)
  }
  return db.contentCalendarItem.update({ where: { id: itemId }, data: { status: 'APPROVED' } })
}

export async function cancelContentCalendarItem(ctx: AuthContext, itemId: string) {
  assertPermission(ctx, 'content.manage')
  const item = await getOwnedContentItem(ctx, itemId)
  if (item.status === 'PUBLISHED' || item.status === 'CANCELLED') {
    throw new Error(`Cannot cancel a content item in status ${item.status}.`)
  }
  return db.contentCalendarItem.update({ where: { id: itemId }, data: { status: 'CANCELLED' } })
}

/**
 * APPROVED -> SCHEDULED: prepares the post as a Metricool draft via the
 * Tool Registry. Network(s) come from the caller (the client's connected
 * networks, per `metricool.get_connected_networks`) rather than being
 * inferred here - keeps this function provider-agnostic, per CLAUDE.md
 * rule 6 (agent/tool code never branches on the provider name). Leaves the
 * item APPROVED (not FAILED) on an integration failure - a connection
 * problem isn't a rejection of the content itself, and the item should
 * stay actionable (retry once the integration is reconnected) rather than
 * needing to be recreated from scratch. Marks FAILED only if Metricool
 * itself reports the scheduling failed after accepting the call.
 */
export async function scheduleContentCalendarItem(
  ctx: AuthContext,
  itemId: string,
  input: { networks: string[]; mediaUrls?: string[] },
) {
  assertPermission(ctx, 'content.manage')
  const item = await getOwnedContentItem(ctx, itemId)
  if (item.status !== 'APPROVED') {
    throw new Error(`Cannot schedule a content item in status ${item.status} - it must be APPROVED first.`)
  }

  const result = (await executeTool({
    ctx,
    toolKey: 'metricool.schedule_post',
    clientId: item.clientId,
    input: {
      networks: input.networks,
      text: item.caption ?? '',
      mediaUrls: input.mediaUrls,
      scheduledAt: item.publishDate.toISOString(),
    },
  })) as { providerPostId: string; status: string }

  return db.contentCalendarItem.update({
    where: { id: itemId },
    data: { status: 'SCHEDULED', providerPostId: result.providerPostId },
  })
}
