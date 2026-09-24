'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Gem } from 'lucide-react'
import { xpToNextLevel } from '@/lib/growth/progress'
import type { ClientGrowthBadgeData } from '@/lib/growth/badge'

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
    // A plain fetch, not a Server Action: an action resolving mid-click made
    // the router drop the user's navigation (api/growth/badge/route.ts).
    // Re-fetched on every page change so XP earned or spent in the
    // workspace (quests, shop) shows up without a reload.
    const controller = new AbortController()
    fetch(`/api/growth/badge?clientId=${encodeURIComponent(clientId)}`, { signal: controller.signal, cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ data: ClientGrowthBadgeData | null }>) : { data: null }))
      .then((body) => setData(body.data))
      .catch(() => {
        // Aborted by the next navigation, or offline - keep whatever is shown.
      })
    return () => controller.abort()
  }, [clientId, pathname])

  if (!data) return null

  return (
    // Links to this client's Growth Profile, which has the full level/XP
    // detail - so the level circle can drop out on phones, where the
    // badge + search + bell + theme + avatar otherwise overflowed a 375px
    // header once XP reached four digits.
    <Link
      href={`/dashboard/clients/${clientId}/profile`}
      aria-label={`Growth Profile: level ${data.level}, ${data.xp.toLocaleString()} XP${data.streakCount > 0 ? `, ${data.streakCount}-day streak` : ''}`}
      className="flex shrink-0 items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2"
    >
      {data.streakCount > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-1 text-xs font-bold text-warning sm:px-2.5"
          title={`${data.streakCount}-day streak`}
        >
          <Flame className="h-3.5 w-3.5" /> {data.streakCount}
        </span>
      )}
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-1 text-xs font-bold text-primary sm:px-2.5"
        title={`${xpToNextLevel(data.xp)} XP to next level`}
      >
        <Gem className="h-3.5 w-3.5" /> {data.xp.toLocaleString()}
        <span className="hidden sm:inline">&nbsp;XP</span>
      </span>
      <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background sm:inline-flex" title={`Level ${data.level}`}>
        {data.level}
      </span>
    </Link>
  )
}
