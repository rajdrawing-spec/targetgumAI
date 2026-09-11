'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A collapsible form section - the "progressive sections, not one giant
 * form" requirement without a JS stepper: every field stays mounted (so
 * values survive opening/closing other sections and nothing is lost on
 * submit), the accordion just controls what's visible. Basic is open by
 * default; everything else opens on demand.
 */
export function Section({
  title,
  description,
  defaultOpen = false,
  optional = true,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  optional?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
      >
        <div>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {title}
            {optional && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">Optional</span>}
          </span>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cn('space-y-4 px-4 pb-4', !open && 'hidden')}>{children}</div>
    </div>
  )
}

export function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-caption">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-caption">{hint}</p>}
    </div>
  )
}
