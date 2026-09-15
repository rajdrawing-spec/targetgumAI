'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A small "what is this?" toggle for a field/step a non-expert might not
 * recognize - static, curated plain-language text, not an AI call (faster,
 * cheaper, and always available even if the AI Gateway is down). For an
 * open-ended question this can't cover, pair it with something like the ad
 * campaign wizard's "Ask AI" helper instead.
 */
export function HelpHint({ label = 'What is this?', children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className={cn('relative inline-block align-middle', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] transition-colors',
          open
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
        )}
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="animate-fade-in-scale absolute left-1/2 top-full z-20 mt-1.5 w-64 -translate-x-1/2 rounded-md border border-border bg-card p-2.5 text-xs font-normal leading-relaxed text-foreground shadow-popover"
        >
          {children}
        </span>
      )}
    </span>
  )
}
