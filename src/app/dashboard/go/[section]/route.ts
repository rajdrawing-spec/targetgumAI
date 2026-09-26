import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { LAST_CLIENT_COOKIE, LEARN_SECTIONS, resolveLearnClientId, type LearnSection } from '@/lib/growth/learn-target'

/**
 * GET /dashboard/go/:section - the sidebar's Learn / Practice / Quests /
 * Shop / Profile links. Redirects into the right client workspace (see
 * resolveLearnClientId); with no accessible client, to the Clients list.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const url = (path: string) => new URL(path, request.url)
  const ctx = await getCurrentAuthContext()
  if (!ctx) return NextResponse.redirect(url('/sign-in'))
  if (!(section in LEARN_SECTIONS)) return NextResponse.redirect(url('/dashboard'))

  const clientId = await resolveLearnClientId(ctx, request.cookies.get(LAST_CLIENT_COOKIE)?.value)
  if (!clientId) return NextResponse.redirect(url('/dashboard/clients'))
  return NextResponse.redirect(url(`/dashboard/clients/${clientId}/${LEARN_SECTIONS[section as LearnSection]}`))
}
