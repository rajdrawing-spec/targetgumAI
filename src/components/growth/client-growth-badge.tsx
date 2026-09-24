'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Flame, Gem } from 'lucide-react'
import { xpToNextLevel } from '@/lib/growth/progress'
import { getClientGrowthBadgeAction, type ClientGrowthBadgeData } from '@/app/dashboard/search-actions'

const CLIENT_ID_PATTERN = /^\/dashboard\/clients\/([^/]+)/

/**
 * The top bar's streak/XP/level cluster (docs/DECISIONS.md 2026-09-24) -
 * moved here from the Client Workspace header per explicit direction, to
 * match the reference mockup's top-bar placement. Still genuinely
 * per-client data, not a fake global number: TargetGum is multi-tenant (one
 * agency login manages many clients, each with its own `ClientGrowthProgress`
 * journey), so there is no single "your streak" the way the reference's
 * single-player framing assumes. This reads the client id straight out of
 * the URL (`usePathname`) and only renders once a specific client's
 * workspace is actually in view - elsewhere in the app (Command Center,
 * Clients list, global Insights pages) there is no client to report on, so
 * it renders nothing rather than a stale or made-up number.
 */
export function TopBarGrowthBadge() {
  const pathname = usePathname()
  const clientId = pathname?.match(CLIENT_ID_PATTERN)?.[1] ?? null
  const [data, setData] = useState<ClientGrowthBadgeData | null>(null)

  useEffect(() => {
    if (!clientId) {
      setData(null)
      return
    }
    let cancelled = false
    getClientGrowthBadgeAction(clientId).then((result) => {
      if (!cancelled) setData(result)
    })
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!data) return null

  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      {data.streakCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold text-warning" title={`${data.streakCount}-day streak`}>
          <Flame className="h-3.5 w-3.5" /> {data.streakCount}
        </span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary" title={`${xpToNextLevel(data.xp)} XP to next level`}>
        <Gem className="h-3.5 w-3.5" /> {data.xp.toLocaleString()} XP
      </span>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background" title={`Level ${data.level}`}>
        {data.level}
      </span>
    </div>
  )
}
