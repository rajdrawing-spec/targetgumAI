import type { AutomationLevel, ClientStatus, IntegrationHealth, IntegrationProvider, Prisma } from '@prisma/client'
import { db } from '@/lib/db/client'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * The Clients list's data source: one query per page load that returns,
 * for every client the caller may see, everything the row needs -
 * profile, account manager, primary contact, connected integrations with
 * health, attention counts (filtered relation counts, computed in SQL,
 * never by fetching the rows), and the last activity timestamp. Search,
 * filters and sorting all happen here so the page never re-fetches or
 * post-processes data the server already narrowed.
 *
 * Tenant scoping is the same rule as `listAccessibleClients`: ALL-access
 * roles see the organization, scoped roles only their assigned clients.
 */

export const NEEDS_ATTENTION_HEALTH: IntegrationHealth[] = ['AUTH_REQUIRED', 'ERROR', 'DEGRADED', 'DISCONNECTED']

export type ClientSort = 'updated' | 'name' | 'attention' | 'activity'
export type HealthFilter = 'any' | 'attention' | 'connected' | 'none'
export type StatusFilter = ClientStatus | 'ALL' | 'NOT_ARCHIVED'

export interface ClientListFilter {
  q?: string
  status?: StatusFilter
  automation?: AutomationLevel
  accountManagerId?: string
  health?: HealthFilter
  sort?: ClientSort
  limit?: number
}

export interface ClientSummaryRow {
  id: string
  name: string
  slug: string
  status: ClientStatus
  automationLevel: AutomationLevel
  industry: string | null
  website: string | null
  city: string | null
  country: string | null
  tags: string[]
  updatedAt: Date
  archivedAt: Date | null
  accountManager: { id: string; label: string } | null
  primaryContact: { name: string; email: string | null } | null
  integrations: Array<{ provider: IntegrationProvider; status: IntegrationHealth; lastSuccessfulSyncAt: Date | null }>
  attention: { pendingApprovals: number; highPriorityRecommendations: number; openTasks: number; integrationIssues: number }
  lastActivityAt: Date | null
}

export async function listClientsWithSummary(ctx: AuthContext, filter: ClientListFilter = {}): Promise<ClientSummaryRow[]> {
  assertPermission(ctx, 'clients.read')

  const scope: Prisma.ClientWhereInput =
    ctx.clientAccess.kind === 'ALL'
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, id: { in: Array.from(ctx.clientAccess.clientIds) } }

  const status = filter.status ?? 'NOT_ARCHIVED'
  const q = filter.q?.trim()
  const where: Prisma.ClientWhereInput = {
    ...scope,
    ...(status === 'NOT_ARCHIVED' ? { status: { not: 'ARCHIVED' } } : status === 'ALL' ? {} : { status }),
    ...(filter.automation && { automationLevel: filter.automation }),
    ...(filter.accountManagerId && { accountManagerId: filter.accountManagerId }),
    ...(filter.health === 'attention' && { integrationConnections: { some: { status: { in: NEEDS_ATTENTION_HEALTH } } } }),
    ...(filter.health === 'connected' && { integrationConnections: { some: { status: 'CONNECTED' } } }),
    ...(filter.health === 'none' && { integrationConnections: { none: {} } }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
        { website: { contains: q, mode: 'insensitive' } },
        { industry: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
        { contacts: { some: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } } },
      ],
    }),
  }

  const rows = await db.client.findMany({
    where,
    orderBy: filter.sort === 'name' ? { name: 'asc' } : { updatedAt: 'desc' },
    take: filter.limit ?? 200,
    // Five nested relations (accountManager.user, contacts,
    // integrationConnections.integrationAccount.integration, aiRuns, and
    // three filtered _counts) per row - a real SQL join keeps this at one
    // round trip instead of Prisma's default per-relation batching. This
    // query backs both the Clients list and the Overview dashboard.
    relationLoadStrategy: 'join',
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      automationLevel: true,
      industry: true,
      website: true,
      city: true,
      country: true,
      tags: true,
      updatedAt: true,
      archivedAt: true,
      accountManager: { select: { id: true, user: { select: { name: true, email: true } } } },
      contacts: { where: { isPrimary: true }, take: 1, select: { name: true, email: true } },
      integrationConnections: {
        select: { status: true, lastSuccessfulSyncAt: true, integrationAccount: { select: { integration: { select: { provider: true } } } } },
      },
      aiRuns: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      _count: {
        select: {
          approvals: { where: { status: 'PENDING' } },
          recommendations: { where: { status: 'RECOMMENDED', priority: { in: ['HIGH', 'CRITICAL'] } } },
          tasks: { where: { status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] } } },
        },
      },
    },
  })

  const result: ClientSummaryRow[] = rows.map((row) => {
    const integrations = row.integrationConnections.map((c) => ({
      provider: c.integrationAccount.integration.provider,
      status: c.status,
      lastSuccessfulSyncAt: c.lastSuccessfulSyncAt,
    }))
    const integrationIssues = integrations.filter((i) => NEEDS_ATTENTION_HEALTH.includes(i.status)).length
    const lastRun = row.aiRuns[0]?.createdAt ?? null
    const lastActivityAt = lastRun && lastRun > row.updatedAt ? lastRun : row.updatedAt
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      automationLevel: row.automationLevel,
      industry: row.industry,
      website: row.website,
      city: row.city,
      country: row.country,
      tags: row.tags,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
      accountManager: row.accountManager
        ? { id: row.accountManager.id, label: row.accountManager.user.name || row.accountManager.user.email }
        : null,
      primaryContact: row.contacts[0] ?? null,
      integrations,
      attention: {
        pendingApprovals: row._count.approvals,
        highPriorityRecommendations: row._count.recommendations,
        openTasks: row._count.tasks,
        integrationIssues,
      },
      lastActivityAt,
    }
  })

  // Attention/activity sorts need the derived numbers - the list is
  // bounded (take above) and small per organization, so sorting here is
  // cheaper than a second query.
  if (filter.sort === 'attention') {
    result.sort((a, b) => attentionScore(b) - attentionScore(a) || a.name.localeCompare(b.name))
  } else if (filter.sort === 'activity') {
    result.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))
  }
  return result
}

export function attentionScore(row: ClientSummaryRow): number {
  const a = row.attention
  return a.pendingApprovals * 3 + a.integrationIssues * 3 + a.highPriorityRecommendations * 2 + a.openTasks
}
