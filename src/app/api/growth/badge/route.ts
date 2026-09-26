import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getClientGrowthBadge } from '@/lib/growth/badge'

/**
 * GET /api/growth/badge?clientId= - the top bar badge's data.
 *
 * A plain GET route rather than a Server Action on purpose (docs/
 * DECISIONS.md 2026-09-24): Next.js serializes Server Actions with router
 * navigations, and this one ran on every page mount - when it resolved
 * mid-click (it queues behind the sidebar's prefetches) the router
 * silently dropped the user's navigation. A fetch never touches the
 * router. Same authorization as before: session, not a client-portal
 * user, `growth.read`, and tenant-scoped client access.
 */
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId')
  const data = clientId ? await getClientGrowthBadge(await getCurrentAuthContext(), clientId) : null
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
