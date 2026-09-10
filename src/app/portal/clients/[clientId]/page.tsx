import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Lightbulb, FileText, MessageSquare, Check, X, CalendarDays } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listContentCalendarItems } from '@/lib/content-calendar/persist'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { listRecommendations } from '@/lib/recommendations/persist'
import { listReports } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  portalAcceptRecommendationAction,
  portalRejectRecommendationAction,
  submitFeedbackAction,
} from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * The Client Portal's main view for one client (BRD Section 4.4): review
 * and accept/reject recommendations, see CLIENT-facing reports
 * (`listReports` already redacts to CLIENT-type only for a client_user -
 * `src/lib/reports/generate.ts`), view content/creative (read-only -
 * `listContentCalendarItems` gates on `clients.read`, which client_user
 * already holds, same as reports; no `content.manage` needed to view), and
 * leave feedback. No tasks, no Approval-Engine approvals, no AI runs, no
 * integration detail - none of that is a client capability per Section 4.4.
 */
export default async function PortalClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  let client
  try {
    client = await getAuthorizedClient(ctx, clientId)
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }

  const [recommendations, reports, contentItems] = await Promise.all([
    listRecommendations(ctx, clientId),
    listReports(ctx, clientId),
    listContentCalendarItems(ctx, clientId),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-foreground">{client.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-muted-foreground" /> Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <EmptyState icon={Lightbulb} title="Nothing to review right now" />
          ) : (
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rec.priority} />
                      <span className="text-sm font-medium text-foreground">{rec.area}</span>
                    </div>
                    <StatusBadge status={rec.status} />
                  </div>
                  <p className="mt-2 text-sm text-foreground">{rec.finding}</p>
                  <p className="mt-1 text-sm text-muted-foreground">→ {rec.recommendation}</p>

                  {rec.status === 'RECOMMENDED' && (
                    <div className="mt-3 flex gap-2">
                      <form action={portalAcceptRecommendationAction.bind(null, rec.id, clientId)}>
                        <Button type="submit" size="sm">
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                      </form>
                      <form action={portalRejectRecommendationAction.bind(null, rec.id, clientId, 'Rejected from client portal.')}>
                        <Button type="submit" variant="outline" size="sm">
                          <X className="h-3.5 w-3.5" /> Decline
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" /> Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((report) => (
                <li key={report.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/portal/reports/${report.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                    {report.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-muted-foreground" /> Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contentItems.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing planned yet" />
          ) : (
            <ul className="divide-y divide-border">
              {contentItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{item.caption || item.platform}</p>
                    <p className="text-xs tabular-nums text-caption">
                      {item.platform} · {item.publishDate.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-muted-foreground" /> Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitFeedbackAction.bind(null, clientId)} className="space-y-3">
            <Textarea name="content" required rows={3} placeholder="Anything you'd like your team to know…" />
            <Button type="submit" variant="outline">
              Send feedback
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
