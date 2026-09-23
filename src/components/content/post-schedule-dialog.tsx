'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarDays, Plus, Sparkles, Hash, Rocket } from 'lucide-react'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { quickSchedulePostAction } from '@/app/dashboard/actions'

interface PostScheduleDialogProps {
  clients: Array<{ id: string; name: string }>
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'youtube', label: 'YouTube Shorts' },
]

export function PostScheduleDialog({ clients }: PostScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const addHashtags = () => {
    const tags = '\n\n#DigitalMarketing #GrowthHacking #Ecommerce #AI #MarketingStrategy'
    setCaption((prev) => (prev ? prev + tags : tags.trim()))
  }

  const addCta = () => {
    const cta = '\n\n👉 Click the link in bio to explore our exclusive launch collection! Limited stock available.'
    setCaption((prev) => (prev ? prev + cta : cta.trim()))
  }

  const polishCopy = () => {
    if (!caption) return
    setCaption((prev) => `✨ Discover the new standard: ${prev.trim()} 🚀 Elevate your results today!`)
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 shadow-sm font-semibold"
        size="sm"
      >
        <Plus className="h-4 w-4" /> Schedule Post
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 text-foreground shadow-popover backdrop:bg-foreground/40"
      >
        {open && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Schedule Social Post</h2>
                  <p className="text-xs text-muted-foreground">Draft and queue content across connected channels.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <ActionForm
              action={quickSchedulePostAction}
              onSuccess={() => {
                setOpen(false)
                setCaption('')
              }}
              className="space-y-4"
            >
              {/* Client Selector */}
              <div>
                <label htmlFor="clientId" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Client Brand
                </label>
                <select
                  id="clientId"
                  name="clientId"
                  required
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-subtle"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-semibold cursor-pointer transition-colors ${
                        platform === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name="platform"
                        value={p.id}
                        checked={platform === p.id}
                        onChange={() => setPlatform(p.id)}
                        className="sr-only"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Publish Date & Time */}
              <div>
                <label htmlFor="publishDate" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Scheduled Date & Time
                </label>
                <Input
                  id="publishDate"
                  name="publishDate"
                  type="datetime-local"
                  required
                  defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 16)}
                />
              </div>

              {/* Caption with AI Tools */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="caption" className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Post Caption / Copy
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={polishCopy}
                      title="Enhance copy tone with AI"
                      className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground hover:brightness-95 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" /> AI Polish
                    </button>
                    <button
                      type="button"
                      onClick={addHashtags}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <Hash className="h-3 w-3" /> Hashtags
                    </button>
                    <button
                      type="button"
                      onClick={addCta}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <Rocket className="h-3 w-3" /> CTA
                    </button>
                  </div>
                </div>
                <Textarea
                  id="caption"
                  name="caption"
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Draft your promotional hook, product benefits, or educational caption..."
                  required
                />
              </div>

              {/* Immediate Approval Checkbox */}
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  name="autoApprove"
                  defaultChecked
                  className="h-4 w-4 rounded border-input text-primary"
                />
                Approve and queue immediately for automated scheduling
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton size="sm" className="gap-1.5 font-semibold">
                  <CalendarDays className="h-3.5 w-3.5" /> Queue Post
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
      </dialog>
    </>
  )
}
