import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listApprovals } from '@/lib/approvals/approvals'
import { listAccessibleClients } from '@/lib/clients/list'
import { approveApprovalAction, rejectApprovalAction } from '../actions'

export default async function ApprovalsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const [approvals, clients] = await Promise.all([listApprovals(ctx), listAccessibleClients(ctx)])
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]))

  // `approvals.approve` (Account Manager+) is required to decide - Marketing
  // Employee can request/view approvals but not decide them (BRD 4.2-4.3).
  const canDecide = ctx.permissions.has('approvals.approve')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Approvals</h1>
      {approvals.length === 0 ? (
        <p className="text-sm text-gray-400">No approval requests.</p>
      ) : (
        <ul className="space-y-3">
          {approvals.map((approval) => (
            <li key={approval.id} className="rounded border border-gray-200 p-4 text-sm">
              <div className="flex items-center justify-between">
                <Link href={`/dashboard/clients/${approval.clientId}`} className="font-medium hover:underline">
                  {clientNameById.get(approval.clientId) ?? approval.clientId}
                </Link>
                <span className="text-xs text-gray-500">
                  {approval.riskLevel} · {approval.status}
                </span>
              </div>
              <p className="mt-2 text-gray-700">{approval.actionSummary}</p>

              {canDecide && approval.status === 'PENDING' && (
                <div className="mt-3 flex gap-2">
                  <form action={approveApprovalAction.bind(null, approval.id, approval.clientId)}>
                    <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800">
                      Approve
                    </button>
                  </form>
                  <form action={rejectApprovalAction.bind(null, approval.id, approval.clientId, 'Rejected from dashboard.')}>
                    <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
