'use client'

import { Trash2 } from 'lucide-react'
import type { ActionResult } from '@/lib/actions/result'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type BoundAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>

/**
 * The Client Settings "Danger zone" trigger buttons, split out into their
 * own client component so `ConfirmDialog`'s `trigger` render-prop closure
 * is created client-side. The settings page itself is a Server Component;
 * a plain function (as opposed to a Server Action) can never cross the
 * server->client boundary as a prop, and `trigger={(open) => <Button ...>}`
 * defined inline there is exactly that - it crashed the page in production
 * ("Functions cannot be passed directly to Client Components..."), silently
 * surviving `next dev` because that boundary isn't enforced there. The
 * bound server actions (`action` below) are unaffected - Next.js explicitly
 * supports passing a Server Action, `.bind()` included, from server to
 * client. Markup/classes are unchanged from what this replaces.
 */
export function ArchiveOrRestoreAction({
  clientName,
  archived,
  action,
}: {
  clientName: string
  archived: boolean
  action: BoundAction
}) {
  return archived ? (
    <ConfirmDialog
      trigger={(open) => (
        <Button type="button" variant="outline" onClick={open}>
          Restore
        </Button>
      )}
      title={`Restore ${clientName}?`}
      description="The client becomes active again and reappears in lists, dashboards and automation."
      confirmLabel="Restore client"
      destructive={false}
      action={action}
    />
  ) : (
    <ConfirmDialog
      trigger={(open) => (
        <Button type="button" variant="outline" onClick={open}>
          Archive
        </Button>
      )}
      title={`Archive ${clientName}?`}
      description="Archiving hides the client from lists and stops scheduled automation. Nothing is deleted - you can restore it at any time."
      confirmLabel="Archive client"
      destructive={false}
      action={action}
    />
  )
}

export function DeleteClientAction({ clientName, action }: { clientName: string; action: BoundAction }) {
  return (
    <ConfirmDialog
      trigger={(open) => (
        <Button type="button" variant="destructive" onClick={open}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      )}
      title={`Delete ${clientName}?`}
      description={
        <>
          This permanently removes the client and everything attached to it - contacts, Client Brain, integrations,
          recommendations, tasks, reports and content. The audit trail is kept. <strong>This cannot be undone.</strong>
        </>
      }
      confirmLabel="Delete permanently"
      requireText={clientName}
      action={action}
    />
  )
}
