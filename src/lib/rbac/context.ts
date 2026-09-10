import type { PrismaClient } from '@prisma/client'
import { SCOPED_CLIENT_ACCESS_ROLES, type Permission, type SystemRoleKey } from './permissions'
import type { AuthContext } from './types'

/**
 * Resolves the full authorization context for a user within one
 * organization: their role, permission set, and which clients they may
 * access. Framework-agnostic and DB-only - safe to unit/integration test
 * without Next.js, and the single place tenant/role authorization logic
 * lives (docs/SECURITY.md, "Authorization precedes tool execution").
 *
 * Returns null when the user has no active path into this organization:
 * disabled users, no membership at all, a disabled OrganizationUser row,
 * etc. Callers (src/lib/rbac/guards.ts) turn null into an
 * AuthenticationError - never fall back to a default/partial context.
 */
export async function resolveAuthContext(
  db: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<AuthContext | null> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || user.status !== 'ACTIVE') return null

  const membership = await db.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      assignedClients: true,
    },
  })

  if (membership && membership.status === 'ACTIVE') {
    const roleKey = membership.role.key as SystemRoleKey
    const permissions = new Set(
      membership.role.rolePermissions.map((rp) => rp.permission.key as Permission),
    )

    const clientAccess = SCOPED_CLIENT_ACCESS_ROLES.includes(roleKey)
      ? {
          kind: 'SET' as const,
          clientIds: new Set(membership.assignedClients.map((a) => a.clientId)),
        }
      : { kind: 'ALL' as const }

    return {
      userId,
      organizationId,
      organizationUserId: membership.id,
      roleKey,
      permissions,
      clientAccess,
      isClientUser: false,
    }
  }

  // Not active staff - check for client-portal access instead.
  const clientUserRows = await db.clientUser.findMany({
    where: { userId, client: { organizationId } },
    select: { clientId: true },
  })

  if (clientUserRows.length > 0) {
    const clientRole = await db.role.findUnique({
      where: { organizationId_key: { organizationId, key: 'client_user' } },
      include: { rolePermissions: { include: { permission: true } } },
    })
    const permissions = new Set(
      (clientRole?.rolePermissions ?? []).map((rp) => rp.permission.key as Permission),
    )

    return {
      userId,
      organizationId,
      roleKey: 'client_user',
      permissions,
      clientAccess: { kind: 'SET', clientIds: new Set(clientUserRows.map((c) => c.clientId)) },
      isClientUser: true,
    }
  }

  return null
}

/**
 * Picks the organization a session defaults into when none is explicitly
 * selected. MVP simplification: the first organization the user has any
 * access to, staff membership before client-portal access. Multi-org
 * switching UI is Phase 2 - see docs/DECISIONS.md.
 */
export async function resolveDefaultOrganizationId(
  db: PrismaClient,
  userId: string,
): Promise<string | null> {
  const membership = await db.organizationUser.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true },
  })
  if (membership) return membership.organizationId

  const clientUser = await db.clientUser.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { client: { select: { organizationId: true } } },
  })
  return clientUser?.client.organizationId ?? null
}
