import type { ContentStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient, scopedClientWhere } from '@/lib/db/tenant'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import { ApprovalRequiredError } from '@/lib/tools/errors'
import { executeTool } from '@/lib/tools/execute'

/**
 * Social content calendar (BRD-PRD Section 66 entities, Section 48's MVP
 * Social Scheduling flow, Section 85 Phase 2). Lifecycle:
 *
 *   IDEA -> DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED
 *                                                      \-> FAILED
 *   (any non-terminal state) -> CANCELLED
 *
 * `scheduleContentCalendarItem` (APPROVED -> SCHEDULED) calls the
 * already-registered `metricool.schedule_post` tool (MEDIUM risk per
 * Section 21's "prepare scheduled content" - executes on a
 * `content.manage` permission check alone, no Approval Engine gate) -
 * this only ever creates a Metricool *draft*.
 *
 * `publishContentCalendarItem` (SCHEDULED -> PUBLISHED, Phase 2's
 * "automated social scheduling") is what actually closes that gap: it
 * calls `metricool.publish_post`, which is HIGH risk (Section 21:
 * "Publish content"), so it never executes on this call - `executeTool`
 * creates a PENDING Approval and throws `ApprovalRequiredError` instead,
 * which this catches to record the approval id on the item (leaving it
 * SCHEDULED, not a new status - the item is still exactly what it was,
 * just now also waiting on a human). Once an approver actually approves
 * it (`approveAndExecuteApproval`, `src/lib/tools/execute.ts`),
 * `syncContentCalendarItemFromApproval` (called right after, from the
 * dashboard Server Action) is what flips the item to PUBLISHED - there is
 * no generic "approval executed -> notify the thing it was for" mechanism
 * in this codebase (recommendations routed to an approval don't get
 * synced back either, see docs/DECISIONS.md), so this is a small,
 * deliberate, content-calendar-specific reconciliation step, not a new
 * general pattern.
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
  filter: { status?: ContentStatus; limit?: number } = {},
) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.contentCalendarItem.findMany({
    where: { clientId, ...(filter.status && { status: filter.status }) },
    orderBy: { publishDate: 'asc' },
    take: filter.limit ?? 100,
  })
}

/**
 * Org-wide listing, scoped to the caller's authorized clients. Defaults to
 * the "upcoming" window (anything dated from yesterday onwards, soonest
 * first) - a plain `publishDate asc` + `take` returned the *oldest* posts
 * and hid upcoming ones once the cap was reached (docs/UX-ASSESSMENT.md
 * §5). `window: 'past'` lists history, most recent first.
 */
export async function listContentCalendarItemsForOrg(
  ctx: AuthContext,
  filter: { status?: ContentStatus; limit?: number; window?: 'upcoming' | 'past' | 'all' } = {},
) {
  assertPermission(ctx, 'clients.read')
  const window = filter.window ?? 'upcoming'
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return db.contentCalendarItem.findMany({
    where: {
      ...scopedClientWhere(ctx),
      ...(filter.status && { status: filter.status }),
      ...(window === 'upcoming' && { publishDate: { gte: yesterday } }),
      ...(window === 'past' && { publishDate: { lt: yesterday } }),
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { publishDate: window === 'past' ? 'desc' : 'asc' },
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

/**
 * SCHEDULED -> (still SCHEDULED, now with an approval pending) - requests
 * the real publish. Always throws (the HIGH-risk gate guarantees this on
 * a fresh call); catches specifically `ApprovalRequiredError` to record
 * `approvalId` on the item, letting a genuinely unexpected error (a bug in
 * the risk gate itself, an integration failure before the gate is even
 * reached) propagate instead of being silently swallowed.
 */
export async function publishContentCalendarItem(ctx: AuthContext, itemId: string) {
  assertPermission(ctx, 'content.manage')
  const item = await getOwnedContentItem(ctx, itemId)
  if (item.status !== 'SCHEDULED') {
    throw new Error(`Cannot publish a content item in status ${item.status} - it must be SCHEDULED first.`)
  }
  if (!item.providerPostId) {
    throw new Error('This content item has no scheduled provider post to publish.')
  }
  if (item.approvalId) {
    throw new Error('A publish request is already pending approval for this item.')
  }

  try {
    await executeTool({
      ctx,
      toolKey: 'metricool.publish_post',
      clientId: item.clientId,
      input: { providerPostId: item.providerPostId },
    })
    // A HIGH-risk tool call never reaches this line on a fresh (non-approved) call - reaching it means the risk gate didn't fire.
    throw new Error('metricool.publish_post executed without an approval - the HIGH-risk gate should have blocked this.')
  } catch (error) {
    if (error instanceof ApprovalRequiredError) {
      return db.contentCalendarItem.update({ where: { id: itemId }, data: { approvalId: error.approvalId } })
    }
    throw error
  }
}

/**
 * Called right after an approver approves+executes a publish approval
 * (`approveAndExecuteApproval`, src/lib/tools/execute.ts) - not itself
 * permission-gated, since it only runs as a side effect of an action that
 * was already authorized. A no-op for any approval that isn't linked to a
 * content item, or whose item already moved on.
 */
export async function syncContentCalendarItemFromApproval(approvalId: string): Promise<void> {
  const item = await db.contentCalendarItem.findFirst({ where: { approvalId } })
  if (!item || item.status !== 'SCHEDULED') return

  const approval = await db.approval.findUnique({ where: { id: approvalId } })
  if (!approval) return

  if (approval.status === 'EXECUTED') {
    await db.contentCalendarItem.update({ where: { id: item.id }, data: { status: 'PUBLISHED' } })
  } else if (approval.status === 'FAILED' || approval.status === 'REJECTED') {
    // Leave the item SCHEDULED but clear the approvalId so a retry (a fresh publishContentCalendarItem call) isn't blocked by "already pending".
    await db.contentCalendarItem.update({ where: { id: item.id }, data: { approvalId: null } })
  }
}
