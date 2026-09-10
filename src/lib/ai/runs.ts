import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * AI run listing (BRD-PRD Section 27, 42 - "recent AI runs" on the
 * dashboard). Read-only - `AiRun` rows are written exclusively by the AI
 * Gateway (`src/lib/ai/gateway.ts`). `clientId` is nullable on `AiRun`
 * (a handful of future org-level runs might not be tied to one client), so
 * scoped-access roles see their assigned clients' runs plus any
 * client-less ones - same shape as `listAuditEvents`
 * (`src/lib/audit/record.ts`).
 */
export async function listAiRuns(ctx: AuthContext, filter: { clientId?: string; limit?: number } = {}) {
  assertPermission(ctx, 'clients.read')

  const limit = filter.limit ?? 50

  if (filter.clientId) {
    const client = await getAuthorizedClient(ctx, filter.clientId)
    return db.aiRun.findMany({
      where: { organizationId: ctx.organizationId, clientId: client.id },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
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

  return db.aiRun.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
