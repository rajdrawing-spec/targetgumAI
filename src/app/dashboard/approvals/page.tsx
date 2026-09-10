import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Check, X } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listApprovals } from '@/lib/approvals/approvals'
import { listAccessibleClients } from '@/lib/clients/list'
import { approveApprovalAction, rejectApprovalAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ApprovalsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const [approvals, clients] = await Promise.all([listApprovals(ctx), listAccessibleClients(ctx)])
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]))

  // `approvals.approve` (Account Manager+) is required to decide - Marketing
  // Employee can request/view approvals but not decide them (BRD 4.2-4.3).
  const canDecide = ctx.permissions.has('approvals.approve')

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="HIGH/CRITICAL-risk actions waiting for a human decision." />

      {approvals.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No approval requests" />
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/dashboard/clients/${approval.clientId}`} className="text-sm font-semibold text-foreground hover:text-primary">
                    {clientNameById.get(approval.clientId) ?? approval.clientId}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={approval.riskLevel} />
                    <StatusBadge status={approval.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground">{approval.actionSummary}</p>

                {canDecide && approval.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <form action={approveApprovalAction.bind(null, approval.id, approval.clientId)}>
                      <Button type="submit" size="sm">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </form>
                    <form action={rejectApprovalAction.bind(null, approval.id, approval.clientId, 'Rejected from dashboard.')}>
                      <Button type="submit" variant="outline" size="sm">
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
