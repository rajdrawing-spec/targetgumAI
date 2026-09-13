'use client'

import { useState } from 'react'
import { RotateCw, XCircle } from 'lucide-react'
import type { ActionResult } from '@/lib/actions/result'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { resendInvitationAction, revokeInvitationAction } from '@/app/dashboard/team/actions'
import { CopyableLink } from './copyable-link'

export function InvitationRowActions({ invitationId, email }: { invitationId: string; email: string }) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const bound = (fn: (id: string, prev: ActionResult, fd: FormData) => Promise<ActionResult>) => fn.bind(null, invitationId)

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-1.5">
        <ActionForm action={bound(resendInvitationAction)} onSuccess={(result) => setInviteUrl(result.data?.inviteUrl ?? null)}>
          <SubmitButton variant="ghost" size="sm" pendingLabel="Resending…">
            <RotateCw className="h-3.5 w-3.5" /> Resend
          </SubmitButton>
        </ActionForm>
        <ConfirmDialog
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive-bg"
            >
              <XCircle className="h-3.5 w-3.5" /> Revoke
            </button>
          )}
          title={`Revoke the invitation to ${email}?`}
          description="They will no longer be able to use the emailed link to create an account. Nothing was ever granted to them - there is nothing else to undo."
          confirmLabel="Revoke invitation"
          action={bound(revokeInvitationAction)}
        />
      </div>
      {inviteUrl && (
        <div className="mt-2">
          <CopyableLink url={inviteUrl} onDismiss={() => setInviteUrl(null)} />
        </div>
      )}
    </div>
  )
}
