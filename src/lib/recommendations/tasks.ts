import type { RecommendationPriority, TaskPriority, TaskStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Task management (BRD-PRD Section 40). Staff (Account Manager, Marketing
 * Employee) can create tasks - gated by `tasks.create`, not `clients.manage`
 * - a Client User cannot (BRD Section 4.2-4.4).
 */

const PRIORITY_MAP: Record<RecommendationPriority, TaskPriority> = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'URGENT',
}

export async function createTaskFromRecommendation(
  ctx: AuthContext,
  recommendationId: string,
  input: { ownerId?: string; dueDate?: Date } = {},
) {
  assertPermission(ctx, 'tasks.create')
  const rec = await db.recommendation.findUnique({ where: { id: recommendationId } })
  if (!rec || rec.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this recommendation.')
  }
  const client = await db.client.findUnique({ where: { id: rec.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this recommendation.')
  assertClientAccess(ctx, client)

  const evidenceLines = Array.isArray(rec.evidence) ? (rec.evidence as string[]) : []
  const description = [
    rec.recommendation,
    evidenceLines.length > 0 ? `\nEvidence: ${evidenceLines.join('; ')}` : '',
    rec.likelyCause ? `\nLikely cause: ${rec.likelyCause}` : '',
  ]
    .filter(Boolean)
    .join('')

  return db.task.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: rec.clientId,
      title: rec.finding,
      description,
      priority: PRIORITY_MAP[rec.priority],
      ownerId: input.ownerId,
      dueDate: input.dueDate,
      sourceRecommendationId: recommendationId,
      createdBy: ctx.userId,
    },
  })
}

export async function listTasks(ctx: AuthContext, clientId: string, filter: { status?: TaskStatus } = {}) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.task.findMany({
    where: { clientId, ...(filter.status && { status: filter.status }) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateTaskStatus(ctx: AuthContext, taskId: string, status: TaskStatus) {
  assertPermission(ctx, 'tasks.create') // whoever can create tasks can update their status
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task || task.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this task.')
  }
  const client = await db.client.findUnique({ where: { id: task.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this task.')
  assertClientAccess(ctx, client)

  return db.task.update({ where: { id: taskId }, data: { status } })
}
