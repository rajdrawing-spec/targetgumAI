'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { ActionResult } from '@/lib/actions/result'
import { ActionForm, FieldError, SubmitButton } from './action-form'
import { Button } from './button'
import { Input } from './input'

/**
 * Confirmation for destructive actions, built on the native <dialog>
 * element (focus trapping, Escape, backdrop for free). Optionally requires
 * the user to type an exact phrase (a client's name) before the confirm
 * button enables; the server action enforces the same check, so this is
 * a guard against slips, not the security boundary.
 */
export function ConfirmDialog({
  trigger,
  isOpen: controlledOpen,
  onClose: controlledOnClose,
  title,
  description,
  confirmLabel,
  action,
  requireText,
  requireTextLabel,
  destructive = true,
  onSuccess,
}: {
  trigger?: (open: () => void) => ReactNode
  isOpen?: boolean
  onClose?: () => void
  title: string
  description: ReactNode
  confirmLabel: string
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>
  /** Exact text the user must type to enable the confirm button. */
  requireText?: string
  requireTextLabel?: string
  destructive?: boolean
  onSuccess?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => {
    if (isControlled) {
      controlledOnClose?.()
    } else {
      setInternalOpen(false)
    }
    setTyped('')
  }
  const ready = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase()

  return (
    <>
      {trigger?.(() => {
        if (isControlled) {
          // controlled mode
        } else {
          setInternalOpen(true)
        }
      })}
      <dialog
        ref={ref}
        onClose={close}
        className="w-full max-w-md rounded-xl border border-border bg-card p-0 text-foreground shadow-popover backdrop:bg-foreground/30"
      >
        {open && (
          <ActionForm action={action} className="p-5" onSuccess={() => { close(); onSuccess?.() }}>
            <div className="flex items-start gap-3">
              {destructive && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive-bg text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-foreground">{title}</h2>
                <div className="mt-1 text-sm text-muted-foreground">{description}</div>
              </div>
            </div>
            {requireText && (
              <div className="mt-4">
                <label htmlFor="confirmName" className="mb-1.5 block text-xs font-medium text-caption">
                  {requireTextLabel ?? `Type "${requireText}" to confirm`}
                </label>
                <Input id="confirmName" name="confirmName" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
                <FieldError name="confirmName" />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <SubmitButton variant={destructive ? 'destructive' : 'primary'} size="sm" disabled={!ready} pendingLabel="Working…">
                {confirmLabel}
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </dialog>
    </>
  )
}
