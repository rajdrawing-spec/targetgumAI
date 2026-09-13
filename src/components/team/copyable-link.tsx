'use client'

import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shown when email delivery isn't configured on this deployment
 * (`EMAIL_SERVER_HOST` unset - `src/lib/email/mailer.ts`) - the invitation
 * still exists, there is just nobody to automatically hand the link to.
 * The Super Admin copies it and sends it however they can reach the
 * invitee (chat, a different email account, etc).
 */
export function CopyableLink({ url, onDismiss }: { url: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can fail (permissions, insecure context) - the
      // text is still selectable/readable in the box either way.
    }
  }

  return (
    <div className="rounded-md border border-warning/30 bg-warning-bg p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-warning">Email delivery isn&apos;t configured on this deployment. Copy this link and send it to them yourself:</p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-warning/70 hover:text-warning">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1.5 text-xs text-foreground">{url}</code>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
