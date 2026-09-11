import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Check, Send, Upload, X } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listContentCalendarItemsForOrg } from '@/lib/content-calendar/persist'
import {
  approveContentItemAction,
  cancelContentItemAction,
  publishContentItemAction,
  scheduleContentItemAction,
  submitContentForReviewAction,
} from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'

const WINDOW_TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
] as const

/** Networks Metricool can schedule to. A checkbox list beats a free-text field that silently accepted typos. */
const NETWORKS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube', 'pinterest', 'threads']

/**
 * Social content calendar (BRD Section 66/48, Phase 2 Section 85). Shows
 * every ContentCalendarItem across every client the caller can see, with
 * the status-transition actions available at each stage. Creating a new
 * item happens from a specific client's workspace (a client is already in
 * scope there).
 */
export default async function ContentCalendarPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const [{ window: windowParam }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const window = windowParam === 'past' ? 'past' : 'upcoming'
  const items = await listContentCalendarItemsForOrg(ctx, { window, limit: 100 })
  const canManage = ctx.permissions.has('content.manage')

  // Group by day so the list reads as a calendar, not a flat feed.
  const byDay = new Map<string, typeof items>()
  for (const item of items) {
    const day = item.publishDate.toISOString().slice(0, 10)
    byDay.set(day, [...(byDay.get(day) ?? []), item])
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Content calendar" description="Draft, review, and schedule social posts across every client." />

      <FilterTabs param="window" value={window} options={[...WINDOW_TABS]} basePath="/dashboard/content-calendar" />

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={window === 'upcoming' ? 'Nothing scheduled ahead' : 'No past posts'}
          description={
            window === 'upcoming'
              ? 'Add a post from a client\'s workspace ("Add to calendar"). Drafts, reviews and scheduled posts all show up here by date.'
              : 'Published, cancelled and failed posts older than a day appear here.'
          }
        />
      ) : (
        <div className="space-y-6">
          {Array.from(byDay.entries()).map(([day, dayItems]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-caption">{formatDay(day)}</h2>
              {dayItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/clients/${item.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                          {item.client?.name ?? item.clientId}
                        </Link>
                        <span className="text-xs text-caption">{item.platform}</span>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.caption && <p className="mt-2 text-sm text-foreground">{item.caption}</p>}
                    {item.providerPostId && <p className="mt-1 text-xs text-caption">Metricool draft id: {item.providerPostId}</p>}

                    {canManage && (item.status === 'IDEA' || item.status === 'DRAFT') && (
                      <ActionForm action={submitContentForReviewAction.bind(null, item.id, item.clientId)} className="mt-3">
                        <SubmitButton variant="outline" size="sm" pendingLabel="Submitting…">
                          <Send className="h-3.5 w-3.5" /> Submit for review
                        </SubmitButton>
                      </ActionForm>
                    )}

                    {canManage && item.status === 'IN_REVIEW' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ActionForm action={approveContentItemAction.bind(null, item.id, item.clientId)}>
                          <SubmitButton size="sm" pendingLabel="Approving…">
                            <Check className="h-3.5 w-3.5" /> Approve
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={cancelContentItemAction.bind(null, item.id, item.clientId)}>
                          <SubmitButton variant="ghost" size="sm" pendingLabel="Cancelling…">
                            <X className="h-3.5 w-3.5" /> Cancel
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    )}

                    {canManage && item.status === 'APPROVED' && (
                      <ActionForm action={scheduleContentItemAction.bind(null, item.id, item.clientId)} className="mt-3 space-y-2">
                        <fieldset>
                          <legend className="mb-1.5 text-xs font-medium text-caption">Schedule to</legend>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {NETWORKS.map((network) => (
                              <label key={network} className="flex items-center gap-1.5 text-sm text-foreground">
                                <input type="checkbox" name="networks" value={network} defaultChecked={network === item.platform.toLowerCase()} className="h-4 w-4 rounded border-input" />
                                {network}
                              </label>
                            ))}
                          </div>
                          <FieldError name="networks" />
                        </fieldset>
                        <SubmitButton size="sm" pendingLabel="Scheduling…">
                          <CalendarDays className="h-3.5 w-3.5" /> Schedule
                        </SubmitButton>
                      </ActionForm>
                    )}

                    {canManage && item.status === 'SCHEDULED' && (
                      item.approvalId ? (
                        <p className="mt-3 text-xs text-caption">
                          Publish requested - waiting on approval. Check the{' '}
                          <Link href="/dashboard/approvals" className="text-primary hover:underline">Approvals</Link> page.
                        </p>
                      ) : (
                        <ActionForm action={publishContentItemAction.bind(null, item.id, item.clientId)} className="mt-3">
                          <SubmitButton size="sm" pendingLabel="Requesting publish…">
                            <Upload className="h-3.5 w-3.5" /> Publish
                          </SubmitButton>
                        </ActionForm>
                      )
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
