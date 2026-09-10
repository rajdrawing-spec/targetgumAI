import type { RecommendationPriority, TaskPriority, TaskStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient, scopedClientWhere } from '@/lib/db/tenant'
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

/** Org-wide task listing, scoped to the caller's authorized clients (Day 13 dashboard - "tasks due", BRD Section 42). */
export async function listTasksForOrg(ctx: AuthContext, filter: { status?: TaskStatus; limit?: number } = {}) {
  assertPermission(ctx, 'clients.read')
  return db.task.findMany({
    where: { ...scopedClientWhere(ctx), ...(filter.status && { status: filter.status }) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
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
