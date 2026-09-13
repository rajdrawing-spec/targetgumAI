import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Resolves who a scheduled (unattended) workflow run acts as. BRD Section
 * 4.5: "An AI agent is not a user... may only access tools and clients
 * explicitly permitted." A cron trigger is the same shape of problem -
 * there is no human clicking a button, but the run must still go through
 * the exact same `AuthContext`/permission/tenant-scoping chain as every
 * other call in this codebase (no bypass, no invented "system" role).
 *
 * Rather than inventing a new service-account concept (a new User row
 * with no login capability, a new role, a new migration), this resolves
 * the client's own assigned staff: the earliest-assigned active `employee`
 * (holds `analysis.trigger` - see `src/lib/rbac/permissions.ts`). This
 * keeps every automated `AiRun`/`WorkflowRun` attributed to a real,
 * already-permissioned staff member - fully auditable, and reuses the
 * authorization system exactly as-is rather than adding a parallel one.
 *
 * Returns `null` (never a fabricated/fallback actor) when no eligible
 * staff is assigned to the client - the caller must skip that client
 * rather than run on nobody's behalf.
 */
export async function resolveAutomationActor(organizationId: string, clientId: string): Promise<AuthContext | null> {
  const assignments = await db.clientAssignment.findMany({
    where: { clientId },
    include: { organizationUser: { include: { user: true, role: true } } },
    orderBy: { createdAt: 'asc' }, // deterministic when multiple are assigned
  })

  const eligible = assignments.filter(
    (a) =>
      a.organizationUser.status === 'ACTIVE' &&
      a.organizationUser.user.status === 'ACTIVE' &&
      a.organizationUser.role.key === 'employee',
  )
  if (eligible.length === 0) return null

  return resolveAuthContext(db, eligible[0]!.organizationUser.userId, organizationId)
}
