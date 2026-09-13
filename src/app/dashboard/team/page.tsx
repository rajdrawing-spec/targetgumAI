import { redirect } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listOrganizationMembers, listInvitations } from '@/lib/users/invitations'
import { listAccessibleClients } from '@/lib/clients/list'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { InviteForm } from '@/components/team/invite-form'
import { InvitationRowActions } from '@/components/team/invitation-row-actions'
import { formatDateTime } from '@/lib/format'

const ROLE_LABEL: Record<string, string> = { super_admin: 'Super Admin', employee: 'Employee' }

/**
 * Team management (2026-09-13 role-model simplification, docs/DECISIONS.md):
 * the only place people get access to this app. `users.manage` (Super Admin
 * only) gates every function this page calls - a non-Super-Admin visiting
 * this URL hits the shared dashboard error boundary's clean
 * "Missing permission" message, same pattern as `/dashboard/audit`.
 */
export default async function TeamPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const [{ staff, clientUsers }, invitations, clients] = await Promise.all([
    listOrganizationMembers(ctx),
    listInvitations(ctx),
    listAccessibleClients(ctx),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Invite people by email and choose their role. Nothing is granted until they accept."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-muted-foreground" /> Invite someone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{inv.email}</span>
                    <span className="ml-2 text-xs text-caption">
                      {ROLE_LABEL[inv.role] ?? inv.role} · {inv.status === 'EXPIRED' ? 'expired' : `expires ${formatDateTime(inv.expiresAt)}`}
                    </span>
                  </div>
                  <InvitationRowActions invitationId={inv.id} email={inv.email} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff</CardTitle>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <EmptyState icon={UserPlus} title="No staff yet" description="Invite an employee above to get started." />
          ) : (
            <ul className="space-y-2">
              {staff.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{m.user.name || m.user.email}</span>
                    <span className="ml-2 text-xs text-caption">{m.user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.assignedClients.length > 0 && (
                      <span className="text-xs text-caption">{m.assignedClients.map((a) => a.client.name).join(', ')}</span>
                    )}
                    <Badge variant={m.status === 'ACTIVE' ? 'accent' : 'neutral'}>{ROLE_LABEL[m.role.key] ?? m.role.name}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client portal users</CardTitle>
        </CardHeader>
        <CardContent>
          {clientUsers.length === 0 ? (
            <EmptyState icon={UserPlus} title="No client portal users yet" description="Invite a client above to give them portal access." />
          ) : (
            <ul className="space-y-2">
              {clientUsers.map((cu) => (
                <li key={cu.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{cu.user.name || cu.user.email}</span>
                    <span className="ml-2 text-xs text-caption">{cu.user.email}</span>
                  </div>
                  <Badge variant="accent">{cu.client.name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
