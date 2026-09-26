'use client'

import { useEffect } from 'react'

/**
 * Remembers the last Client Workspace opened, so the sidebar's Learn links
 * (/dashboard/go/:section) return to it. Only a preference - the server
 * re-authorizes the id on every use (src/lib/growth/learn-target.ts).
 */
export function RememberClient({ clientId }: { clientId: string }) {
  useEffect(() => {
    document.cookie = `tg_last_client=${encodeURIComponent(clientId)}; path=/; max-age=31536000; samesite=lax`
  }, [clientId])
  return null
}
