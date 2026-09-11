'use client'

import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { ActionResult } from '@/lib/actions/result'
import { ActionForm, FieldError, SubmitButton } from './action-form'
import { Button } from './button'
import { Textarea } from './input'

/**
 * A "Reject / Decline" control that collects a reason before submitting.
 * Rejections used to write a hardcoded 'Rejected from dashboard.' string
 * into the database because no UI asked why (docs/UX-ASSESSMENT.md §6);
 * the reason is what feeds the Client Brain's feedback loop (BRD Section
 * 108), so it is required.
 */
export function RejectWithReason({
  action,
  label = 'Reject',
  confirmLabel = 'Confirm rejection',
  placeholder = 'Why is this being rejected?',
  variant = 'ghost',
  icon,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>
  label?: string
  confirmLabel?: string
  placeholder?: string
  variant?: 'ghost' | 'outline'
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant={variant} size="sm" onClick={() => setOpen(true)}>
        {icon ?? <X className="h-3.5 w-3.5" />} {label}
      </Button>
    )
  }

  return (
    <ActionForm action={action} className="w-full space-y-2 rounded-md border border-border bg-muted/40 p-3" onSuccess={() => setOpen(false)}>
      <Textarea name="reason" rows={2} placeholder={placeholder} autoFocus required minLength={3} maxLength={1000} />
      <FieldError name="reason" />
      <div className="flex gap-2">
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          {confirmLabel}
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  )
}
