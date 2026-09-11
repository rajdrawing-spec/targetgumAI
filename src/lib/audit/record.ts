import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import type { ToolRiskLevel } from '@prisma/client'

/**
 * Append-only audit event writer (BRD-PRD Section 28). This is the ONLY
 * write path exposed from this module - no update/delete function exists
 * here, and none should be added. DB-level REVOKE UPDATE, DELETE for the
 * app's role is still pending a hosting decision (docs/SECURITY.md).
 */

export interface AuditEventInput {
  organizationId: string
  clientId?: string
  userId?: string
  agentId?: string
  aiRunId?: string
  toolExecutionId?: string
  approvalId?: string
  action: string
  provider?: string
  tool?: string
  inputSummary?: object
  outputSummary?: object
  riskLevel?: ToolRiskLevel
  result: 'SUCCESS' | 'FAILURE' | 'DENIED'
  error?: string
}

export async function recordAuditEvent(input: AuditEventInput) {
  return db.auditEvent.create({ data: input })
}

/**
 * Tenant-scoped audit log read. Requires 'audit.read' - only super_admin has
 * it by default (BRD Section 4.1: viewing audit logs is a Super Admin
 * capability), so in practice this only ever returns ALL-access results
 * today; the SET-access branch below is defense-in-depth for if that
 * permission is ever granted more broadly.
 */
export async function listAuditEvents(
  ctx: AuthContext,
  filter: { clientId?: string; limit?: number } = {},
) {
  assertPermission(ctx, 'audit.read')

  const limit = filter.limit ?? 100
  const include = { client: { select: { id: true, name: true } } }

  if (filter.clientId) {
    // Reuses the same tenant check as any other client-scoped read.
    const client = await getAuthorizedClient(ctx, filter.clientId)
    return db.auditEvent.findMany({
      where: { organizationId: ctx.organizationId, clientId: client.id },
      include,
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
  }

  const where =
    ctx.clientAccess.kind === 'ALL'
      ? { organizationId: ctx.organizationId }
      : {
          organizationId: ctx.organizationId,
          OR: [{ clientId: { in: Array.from(ctx.clientAccess.clientIds) } }, { clientId: null }],
        }

  return db.auditEvent.findMany({ where, include, orderBy: { timestamp: 'desc' }, take: limit })
}

/**
 * Display labels (name or email) for the users referenced by a batch of
 * audit events, restricted to members of the caller's organization - a
 * userId from another organization resolves to nothing, never to a name.
 */
export async function resolveActorLabels(ctx: AuthContext, userIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  assertPermission(ctx, 'audit.read')
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
  if (ids.length === 0) return new Map()
  const members = await db.organizationUser.findMany({
    where: { organizationId: ctx.organizationId, userId: { in: ids } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  })
  return new Map(members.map((m) => [m.userId, m.user.name || m.user.email]))
}
