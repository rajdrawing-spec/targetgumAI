import type { ApprovalStatus, Prisma, ToolRiskLevel } from '@prisma/client'
import { db } from '@/lib/db/client'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * The Approval Engine (BRD-PRD Section 21-22). Every HIGH/CRITICAL-risk
 * tool call (src/lib/tools/execute.ts) creates a PENDING approval here
 * instead of executing - this is what replaces the Day 5 hard block.
 *
 * `approvals.approve` gates approve/reject (Account Manager+ per BRD
 * Section 4.2 - Marketing Employee explicitly lacks approval authority,
 * Section 4.3). `approvals.request` gates read/list/cancel-own - both
 * Account Manager and Marketing Employee can request/view.
 */

const DEFAULT_EXPIRY_HOURS = 24 * 7 // 7 days - BRD doesn't specify; a week is a reasonable default until client policy configures it (Day 13+)

export interface CreateApprovalInput {
  organizationId: string
  clientId: string
  requestedBy: string
  agentId?: string
  workflowRunId?: string
  actionType: string
  riskLevel: ToolRiskLevel
  actionSummary: string
  proposedChanges?: Prisma.InputJsonValue
  estimatedImpact?: Prisma.InputJsonValue
  expiresInHours?: number
}

export async function createApproval(input: CreateApprovalInput) {
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000)
  return db.approval.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      requestedBy: input.requestedBy,
      agentId: input.agentId,
      workflowRunId: input.workflowRunId,
      actionType: input.actionType,
      riskLevel: input.riskLevel,
      actionSummary: input.actionSummary,
      proposedChanges: input.proposedChanges,
      estimatedImpact: input.estimatedImpact,
      status: 'PENDING',
      expiresAt,
    },
  })
}

export async function listApprovals(
  ctx: AuthContext,
  filter: { clientId?: string; status?: ApprovalStatus; limit?: number } = {},
) {
  assertPermission(ctx, 'approvals.request')
  const take = filter.limit ?? 100

  if (filter.clientId) {
    const client = await db.client.findUnique({ where: { id: filter.clientId } })
    if (!client) throw new ForbiddenError('Not authorized for this client.')
    assertClientAccess(ctx, client)
    return db.approval.findMany({
      where: { organizationId: ctx.organizationId, clientId: client.id, ...(filter.status && { status: filter.status }) },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    })
  }

  const where =
    ctx.clientAccess.kind === 'ALL'
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, clientId: { in: Array.from(ctx.clientAccess.clientIds) } }
  return db.approval.findMany({
    where: { ...where, ...(filter.status && { status: filter.status }) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

async function getOwnedApproval(ctx: AuthContext, approvalId: string) {
  const approval = await db.approval.findUnique({ where: { id: approvalId } })
  if (!approval || approval.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this approval.')
  }
  const client = await db.client.findUnique({ where: { id: approval.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this approval.')
  assertClientAccess(ctx, client)
  return approval
}

export async function getApproval(ctx: AuthContext, approvalId: string) {
  assertPermission(ctx, 'approvals.request')
  return getOwnedApproval(ctx, approvalId)
}

async function expireIfPast(approval: { id: string; status: ApprovalStatus; expiresAt: Date | null }) {
  if (approval.status === 'PENDING' && approval.expiresAt && approval.expiresAt < new Date()) {
    await db.approval.update({ where: { id: approval.id }, data: { status: 'EXPIRED' } })
    return true
  }
  return false
}

export async function approveApproval(ctx: AuthContext, approvalId: string) {
  assertPermission(ctx, 'approvals.approve')
  const approval = await getOwnedApproval(ctx, approvalId)
  if (await expireIfPast(approval)) throw new Error('This approval has expired.')
  if (approval.status !== 'PENDING') {
    throw new Error(`Cannot approve an approval in status ${approval.status}.`)
  }
  return db.approval.update({
    where: { id: approvalId },
    data: { status: 'APPROVED', approvedBy: ctx.userId, approvedAt: new Date() },
  })
}

export async function rejectApproval(ctx: AuthContext, approvalId: string, reason: string) {
  assertPermission(ctx, 'approvals.approve')
  const approval = await getOwnedApproval(ctx, approvalId)
  if (await expireIfPast(approval)) throw new Error('This approval has expired.')
  if (approval.status !== 'PENDING') {
    throw new Error(`Cannot reject an approval in status ${approval.status}.`)
  }
  return db.approval.update({
    where: { id: approvalId },
    data: { status: 'REJECTED', rejectedReason: reason },
  })
}

/** The original requester can cancel their own pending request; an approver can cancel any. */
export async function cancelApproval(ctx: AuthContext, approvalId: string) {
  const approval = await getOwnedApproval(ctx, approvalId)
  if (approval.requestedBy !== ctx.userId) {
    assertPermission(ctx, 'approvals.approve')
  }
  if (approval.status !== 'PENDING') {
    throw new Error(`Cannot cancel an approval in status ${approval.status}.`)
  }
  return db.approval.update({ where: { id: approvalId }, data: { status: 'CANCELLED' } })
}

export async function markApprovalExecuted(approvalId: string) {
  return db.approval.update({ where: { id: approvalId }, data: { status: 'EXECUTED' } })
}

export async function markApprovalFailed(approvalId: string) {
  return db.approval.update({ where: { id: approvalId }, data: { status: 'FAILED' } })
}
