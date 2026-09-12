import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus } from 'lucide-react'
import type { AutomationLevel, ClientStatus } from '@prisma/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listClientsWithSummary, type ClientListFilter, type ClientSort, type HealthFilter, type StatusFilter } from '@/lib/clients/summary'
import { listAccountManagerCandidates } from '@/lib/clients/profile'
import { PageHeader } from '@/components/ui/page-header'
import { Badge, StatusBadge, toSentenceCase } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ClientsToolbar } from '@/components/clients/clients-toolbar'
import { ClientRowActions } from '@/components/clients/client-row-actions'
import { HEALTH_DOT, PROVIDER_LABEL, AUTOMATION_LABEL } from '@/components/clients/labels'
import { formatRelative, initials, displayHost } from '@/lib/format'
import { cn } from '@/lib/utils'

type SearchParams = { q?: string; status?: string; automation?: string; manager?: string; health?: string; sort?: string }

const STATUS_VALUES: ClientStatus[] = ['ACTIVE', 'PAUSED', 'ARCHIVED']
const AUTOMATION_VALUES: AutomationLevel[] = ['MANUAL', 'ASSISTED', 'APPROVAL_BASED', 'HIGH_AUTOMATION']
const HEALTH_VALUES: HealthFilter[] = ['attention', 'connected', 'none']
const SORT_VALUES: ClientSort[] = ['name', 'attention', 'activity']

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const filter: ClientListFilter = {
    q: sp.q,
    status: (STATUS_VALUES as string[]).includes(sp.status ?? '') || sp.status === 'ALL' ? (sp.status as StatusFilter) : undefined,
    automation: (AUTOMATION_VALUES as string[]).includes(sp.automation ?? '') ? (sp.automation as AutomationLevel) : undefined,
    accountManagerId: sp.manager || undefined,
    health: HEALTH_VALUES.includes(sp.health as HealthFilter) ? (sp.health as HealthFilter) : undefined,
    sort: SORT_VALUES.includes(sp.sort as ClientSort) ? (sp.sort as ClientSort) : undefined,
  }

  const [clients, managers] = await Promise.all([listClientsWithSummary(ctx, filter), listAccountManagerCandidates(ctx)])
  const canCreate = ctx.permissions.has('clients.manage')
  const canEdit = ctx.permissions.has('clients.edit')
  const hasActiveFilters = Boolean(sp.q || sp.status || sp.automation || sp.manager || sp.health || sp.sort)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage clients, marketing context, integrations and automation settings."
        action={
          canCreate ? (
            <Link href="/dashboard/clients/new" className={buttonVariants({ size: 'default' })}>
              <Plus className="h-4 w-4" /> Add client
            </Link>
          ) : undefined
        }
      />

      <ClientsToolbar managers={managers} />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasActiveFilters ? 'No clients match these filters' : 'No clients yet'}
          description={
            hasActiveFilters
              ? 'Try a different search or clear the filters above.'
              : canCreate
                ? 'Add your first client to start building their marketing context.'
                : 'Ask a Super Admin to create a client and assign you to it.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-[#151518]/60 text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Account manager</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Automation</th>
                <th className="px-4 py-3 font-semibold">Integrations</th>
                <th className="px-4 py-3 font-semibold">Attention</th>
                <th className="px-4 py-3 font-semibold">Last activity</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => {
                const attentionTotal =
                  client.attention.pendingApprovals + client.attention.highPriorityRecommendations + client.attention.integrationIssues
                const host = displayHost(client.website)
                return (
                  <tr key={client.id} className="group">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground font-display">
                          {initials(client.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{client.name}</p>
                          <p className="truncate text-xs text-[#A1A1AA]">
                            {[client.industry, host].filter(Boolean).join(' · ') || (client.city ?? '—')}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#D4D4D8]">{client.accountManager?.label ?? <span className="text-xs text-[#8E8E98]">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{AUTOMATION_LABEL[client.automationLevel]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {client.integrations.length === 0 ? (
                        <span className="text-xs text-[#8E8E98]">None connected</span>
                      ) : (
                        <div className="flex -space-x-0.5" title={client.integrations.map((i) => `${PROVIDER_LABEL[i.provider]}: ${i.status}`).join(', ')}>
                          {client.integrations.slice(0, 6).map((i, idx) => (
                            <span
                              key={idx}
                              className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-card', HEALTH_DOT[i.status])}
                              aria-label={`${PROVIDER_LABEL[i.provider]}: ${toSentenceCase(i.status)}`}
                            />
                          ))}
                          {client.integrations.length > 6 && <span className="pl-1.5 text-xs text-[#A1A1AA]">+{client.integrations.length - 6}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {attentionTotal === 0 ? (
                        <span className="text-xs text-[#8E8E98]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {client.attention.pendingApprovals > 0 && <Badge variant="warning">{client.attention.pendingApprovals} approval{client.attention.pendingApprovals === 1 ? '' : 's'}</Badge>}
                          {client.attention.highPriorityRecommendations > 0 && <Badge variant="info">{client.attention.highPriorityRecommendations} rec{client.attention.highPriorityRecommendations === 1 ? '' : 's'}</Badge>}
                          {client.attention.integrationIssues > 0 && <Badge variant="destructive">{client.attention.integrationIssues} issue{client.attention.integrationIssues === 1 ? '' : 's'}</Badge>}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[#A1A1AA] font-mono-data">{formatRelative(client.lastActivityAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <ClientRowActions client={client} canEdit={canEdit} canManage={canCreate} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
