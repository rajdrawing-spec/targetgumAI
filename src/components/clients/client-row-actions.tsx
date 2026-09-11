'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plug, Trash2, ExternalLink } from 'lucide-react'
import type { ActionResult } from '@/lib/actions/result'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { archiveClientAction, deleteClientAction, unarchiveClientAction } from '@/app/dashboard/clients/actions'

/**
 * The "…" menu on a client row / workspace header: Open, Edit,
 * Integrations, Archive or Restore, Delete. Archive and Delete confirm;
 * Delete additionally requires typing the client's name. Which items show
 * follows the caller's permissions (passed down from the server), never
 * inferred client-side.
 */
export function ClientRowActions({
  client,
  canEdit,
  canManage,
  align = 'right',
}: {
  client: { id: string; name: string; status: string }
  canEdit: boolean
  canManage: boolean
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemClass = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted'
  const archived = client.status === 'ARCHIVED'
  const bound = (fn: (id: string, prev: ActionResult, fd: FormData) => Promise<ActionResult>) => fn.bind(null, client.id)

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${client.name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-popover ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <Link role="menuitem" href={`/dashboard/clients/${client.id}`} className={itemClass} onClick={() => setOpen(false)}>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> Open
          </Link>
          {canEdit && (
            <Link role="menuitem" href={`/dashboard/clients/${client.id}/settings`} className={itemClass} onClick={() => setOpen(false)}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit client
            </Link>
          )}
          <Link role="menuitem" href={`/dashboard/clients/${client.id}/integrations`} className={itemClass} onClick={() => setOpen(false)}>
            <Plug className="h-3.5 w-3.5 text-muted-foreground" /> Integrations
          </Link>
          {canManage && (
            <>
              <div className="my-1 border-t border-border" />
              {archived ? (
                <ConfirmDialog
                  trigger={(openDialog) => (
                    <button type="button" role="menuitem" className={itemClass} onClick={() => { setOpen(false); openDialog() }}>
                      <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" /> Restore
                    </button>
                  )}
                  title={`Restore ${client.name}?`}
                  description="The client becomes active again and reappears in lists, dashboards and automation."
                  confirmLabel="Restore client"
                  destructive={false}
                  action={bound(unarchiveClientAction)}
                />
              ) : (
                <ConfirmDialog
                  trigger={(openDialog) => (
                    <button type="button" role="menuitem" className={itemClass} onClick={() => { setOpen(false); openDialog() }}>
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" /> Archive
                    </button>
                  )}
                  title={`Archive ${client.name}?`}
                  description="Archiving hides the client from lists and stops scheduled automation. Nothing is deleted - you can restore it at any time."
                  confirmLabel="Archive client"
                  destructive={false}
                  action={bound(archiveClientAction)}
                />
              )}
              <ConfirmDialog
                trigger={(openDialog) => (
                  <button type="button" role="menuitem" className={`${itemClass} text-destructive hover:bg-destructive-bg`} onClick={() => { setOpen(false); openDialog() }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
                title={`Delete ${client.name}?`}
                description={
                  <>
                    This permanently removes the client and everything attached to it - contacts, Client Brain, integrations, recommendations, tasks, reports and content. The audit trail is kept. <strong>This cannot be undone.</strong> If you only want it out of the way, archive it instead.
                  </>
                }
                confirmLabel="Delete permanently"
                requireText={client.name}
                action={bound(deleteClientAction)}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
