'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { triggerCreativeWorkflowAction } from '@/app/dashboard/actions'
import { cn } from '@/lib/utils'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'] as const

/**
 * "Generate concepts" - the Creative Agent trigger the Creatives page's
 * empty state has always told people to use, but which had no UI anywhere
 * until now (docs/DECISIONS.md). Needs real input (a campaign brief, at
 * minimum), unlike the other one-click analysis triggers on this page, so
 * it's a small dialog rather than a bare ActionForm+SubmitButton.
 */
export function GenerateConceptsDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" /> Generate concepts
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="w-full max-w-md rounded-2xl border-2 border-border bg-card p-0 text-foreground shadow-popover backdrop:bg-foreground/40"
      >
        {open && (
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Generate creative concepts</h2>
                  <p className="text-xs text-muted-foreground">The Creative Agent drafts concepts from a short brief.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <ActionForm action={triggerCreativeWorkflowAction.bind(null, clientId)} onSuccess={() => setOpen(false)} className="space-y-4">
              <div>
                <Label htmlFor="campaignBrief">Campaign brief</Label>
                <Textarea
                  id="campaignBrief"
                  name="campaignBrief"
                  rows={4}
                  required
                  minLength={3}
                  maxLength={2000}
                  placeholder="e.g. Launching our summer sale - 20% off all skincare, targeting existing customers who haven't purchased in 60 days."
                />
                <FieldError name="campaignBrief" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <select
                    id="platform"
                    name="platform"
                    defaultValue="instagram"
                    className="flex h-10 w-full rounded-xl border-2 border-input bg-card px-3 text-sm transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p[0]!.toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                  <FieldError name="platform" />
                </div>
                <div>
                  <Label htmlFor="count">How many concepts</Label>
                  <Input id="count" name="count" type="number" min={1} max={10} defaultValue={3} required />
                  <FieldError name="count" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                  Cancel
                </button>
                <SubmitButton size="sm" pendingLabel="Generating…">
                  <Sparkles className="h-3.5 w-3.5" /> Generate
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
      </dialog>
    </>
  )
}
