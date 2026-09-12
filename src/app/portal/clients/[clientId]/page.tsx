import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Lightbulb, FileText, MessageSquare, Check, CalendarDays, Eye, DollarSign, TrendingUp, Megaphone, Sparkles } from 'lucide-react'
import type { ContentStatus } from '@prisma/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listClientFeedback } from '@/lib/clients/brain'
import { listContentCalendarItems } from '@/lib/content-calendar/persist'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { listRecommendations } from '@/lib/recommendations/persist'
import { listReports } from '@/lib/reports/generate'
import { listCampaigns } from '@/lib/ads/service'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  portalAcceptRecommendationAction,
  portalRejectRecommendationAction,
  submitFeedbackAction,
} from '../../actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { RejectWithReason } from '@/components/ui/reject-with-reason'

/**
 * The Client Portal's main view for one client (BRD Section 4.4): review
 * and accept/decline recommendations, see CLIENT-facing reports
 * (`listReports` already redacts to CLIENT-type only for a client_user),
 * view planned content (read-only), view ad performance telemetry, and leave feedback.
 */

/**
 * Internal workflow states (IDEA/DRAFT/IN_REVIEW) are staff vocabulary and
 * must not leak to the client; they see whether a post is being prepared,
 * scheduled, or live.
 */
const CLIENT_CONTENT_STATUS: Record<ContentStatus, { label: string; variant: 'neutral' | 'info' | 'success' | 'warning' }> = {
  IDEA: { label: 'In preparation', variant: 'neutral' },
  DRAFT: { label: 'In preparation', variant: 'neutral' },
  IN_REVIEW: { label: 'In preparation', variant: 'neutral' },
  APPROVED: { label: 'Approved', variant: 'info' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  FAILED: { label: 'Needs attention', variant: 'warning' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
}

export default async function PortalClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  let client
  try {
    client = await getAuthorizedClient(ctx, clientId)
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }

  const [recommendations, reports, contentItems, ownFeedback, campaigns] = await Promise.all([
    listRecommendations(ctx, clientId, { limit: 50 }),
    listReports(ctx, clientId, { limit: 50 }),
    listContentCalendarItems(ctx, clientId, { limit: 50 }),
    listClientFeedback(ctx, clientId, 5, { source: 'CLIENT' }),
    listCampaigns(ctx, clientId),
  ])
  const toReview = recommendations.filter((r) => r.status === 'RECOMMENDED')
  const decided = recommendations.filter((r) => r.status !== 'RECOMMENDED')

  // Calculate client ad totals
  let clientImpressions = 0
  let clientClicks = 0
  let clientSpend = 0
  let clientRevenue = 0
  for (const c of campaigns) {
    clientImpressions += c.metrics.impressions
    clientClicks += c.metrics.clicks
    clientSpend += c.metrics.spend
    clientRevenue += c.metrics.revenue
  }
  const clientCtr = clientImpressions > 0 ? (clientClicks / clientImpressions) * 100 : 0
  const clientRoas = clientSpend > 0 ? clientRevenue / clientSpend : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{client.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toReview.length > 0 ? `${toReview.length} recommendation${toReview.length === 1 ? '' : 's'} waiting for your review.` : 'Marketing telemetry and performance portal.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Client Dashboard Active
        </span>
      </div>

      {/* Ad Performance Telemetry for the Client */}
      {clientImpressions > 0 && (
        <Card className="border-border shadow-card bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" /> Live Advertising & Impression Telemetry
              </CardTitle>
              <span className="text-xs text-muted-foreground font-medium">Shared by your marketing team</span>
            </div>
            <CardDescription className="text-xs">
              Real-time impressions, click-through performance, and return on ad spend across your campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-card border border-border p-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Impressions</span>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{clientImpressions.toLocaleString()}</p>
                <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1 mt-0.5">
                  <TrendingUp className="h-3 w-3" /> Active visibility
                </span>
              </div>

              <div className="rounded-lg bg-card border border-border p-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Clicks (CTR)</span>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{clientClicks.toLocaleString()}</p>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">{clientCtr.toFixed(2)}% CTR</span>
              </div>

              <div className="rounded-lg bg-card border border-border p-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Ad Spend</span>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">${clientSpend.toLocaleString()}</p>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">{campaigns.length} campaigns</span>
              </div>

              <div className="rounded-lg bg-card border border-border p-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Return on Ad Spend</span>
                <p className="mt-1 text-xl font-bold text-emerald-600 tabular-nums">{clientRoas.toFixed(2)}x ROAS</p>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">${clientRevenue.toLocaleString()} revenue</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-muted-foreground" /> Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <EmptyState icon={Lightbulb} title="Nothing to review right now" description="Your team will share recommendations here as they come up." />
          ) : (
            <ul className="space-y-3">
              {[...toReview, ...decided].map((rec) => (
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
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <ActionForm action={portalAcceptRecommendationAction.bind(null, rec.id, clientId)}>
                        <SubmitButton size="sm" pendingLabel="Approving…">
                          <Check className="h-3.5 w-3.5" /> Approve
                        </SubmitButton>
                      </ActionForm>
                      <RejectWithReason
                        action={portalRejectRecommendationAction.bind(null, rec.id, clientId)}
                        label="Decline"
                        confirmLabel="Send and decline"
                        placeholder="Let your team know why - e.g. budget, timing, brand fit."
                        variant="outline"
                      />
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
            <EmptyState icon={FileText} title="No reports yet" description="Reports are shared here once your team publishes them." />
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((report) => (
                <li key={report.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/portal/reports/${report.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                    {report.title}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-caption">
                    {report.periodStart.toISOString().slice(0, 10)} – {report.periodEnd.toISOString().slice(0, 10)}
                  </span>
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
            <EmptyState icon={CalendarDays} title="Nothing planned yet" description="Upcoming posts your team is preparing will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {contentItems.map((item) => {
                const view = CLIENT_CONTENT_STATUS[item.status]
                return (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{item.caption || item.platform}</p>
                      <p className="text-xs tabular-nums text-caption">
                        {item.platform} · {item.publishDate.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <Badge variant={view.variant} className="shrink-0">
                      {view.label}
                    </Badge>
                  </li>
                )
              })}
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
        <CardContent className="space-y-4">
          <ActionForm action={submitFeedbackAction.bind(null, clientId)} className="space-y-3" resetOnSuccess>
            <div>
              <Textarea name="content" required minLength={3} rows={3} placeholder="Anything you'd like your team to know…" />
              <FieldError name="content" />
            </div>
            <SubmitButton variant="outline" pendingLabel="Sending…">
              Send feedback
            </SubmitButton>
          </ActionForm>
          {ownFeedback.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-caption">Recently sent</p>
              <ul className="divide-y divide-border">
                {ownFeedback.map((f) => (
                  <li key={f.id} className="py-2 text-sm text-muted-foreground first:pt-0 last:pb-0">
                    <span className="mr-2 text-xs tabular-nums text-caption">{f.createdAt.toISOString().slice(0, 10)}</span>
                    {f.content}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
