import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Check } from 'lucide-react'
import type { ApprovalStatus } from '@prisma/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listApprovals } from '@/lib/approvals/approvals'
import { approveApprovalAction, rejectApprovalAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { RejectWithReason } from '@/components/ui/reject-with-reason'

const STATUS_TABS: Array<{ value: string; label: string; status?: ApprovalStatus }> = [
  { value: 'pending', label: 'Pending', status: 'PENDING' },
  { value: 'executed', label: 'Executed', status: 'EXECUTED' },
  { value: 'rejected', label: 'Rejected', status: 'REJECTED' },
  { value: 'all', label: 'All' },
]

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status: statusParam }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const tab = STATUS_TABS.find((t) => t.value === statusParam) ?? STATUS_TABS[0]!
  const approvals = await listApprovals(ctx, { status: tab.status, limit: 100 })

  // `approvals.approve` (Account Manager+) is required to decide - Marketing
  // Employee can request/view approvals but not decide them (BRD 4.2-4.3).
  const canDecide = ctx.permissions.has('approvals.approve')

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="HIGH/CRITICAL-risk actions waiting for a human decision." />

      <FilterTabs param="status" value={tab.value} options={STATUS_TABS} basePath="/dashboard/approvals" />

      {approvals.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={tab.value === 'pending' ? 'Nothing waiting for approval' : 'No approvals here'}
          description={
            tab.value === 'pending'
              ? 'Approval requests are created automatically when an AI recommendation or a scheduled post would change something risky.'
              : 'Switch tabs to see other states.'
          }
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/dashboard/clients/${approval.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                    {approval.client.name}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={approval.riskLevel} />
                    <StatusBadge status={approval.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground">{approval.actionSummary}</p>
                <p className="mt-1 text-xs tabular-nums text-caption">
                  Requested {approval.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  {approval.status === 'REJECTED' && approval.rejectedReason ? ` · Rejected: ${approval.rejectedReason}` : ''}
                </p>

                {canDecide && approval.status === 'PENDING' && (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <ActionForm action={approveApprovalAction.bind(null, approval.id, approval.clientId)}>
                      <SubmitButton size="sm" pendingLabel="Approving and executing…">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </SubmitButton>
                    </ActionForm>
                    <RejectWithReason action={rejectApprovalAction.bind(null, approval.id, approval.clientId)} variant="outline" />
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
