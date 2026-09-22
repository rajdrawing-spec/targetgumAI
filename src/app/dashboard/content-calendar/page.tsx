import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Check, Send, Upload, X, Grid, ListFilter } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listContentCalendarItemsForOrg } from '@/lib/content-calendar/persist'
import { listAccessibleClients } from '@/lib/clients/list'
import {
  approveContentItemAction,
  cancelContentItemAction,
  publishContentItemAction,
  scheduleContentItemAction,
  submitContentForReviewAction,
} from '../actions'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { PostScheduleDialog } from '@/components/content/post-schedule-dialog'
import { SocialCalendarHub } from '@/components/social/social-calendar-hub'
import { cn } from '@/lib/utils'

const WINDOW_TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
] as const

const NETWORKS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube', 'pinterest', 'threads']

export default async function ContentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; view?: string }>
}) {
  const [{ window: windowParam, view: viewParam }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const window = windowParam === 'past' ? 'past' : 'upcoming'
  const activeView = viewParam ?? 'calendar'

  const [items, clients] = await Promise.all([
    listContentCalendarItemsForOrg(ctx, { window, limit: 100 }),
    listAccessibleClients(ctx),
  ])
  const canManage = ctx.permissions.has('content.manage')

  // Group by day for the list view
  const byDay = new Map<string, typeof items>()
  for (const item of items) {
    const day = item.publishDate.toISOString().slice(0, 10)
    byDay.set(day, [...(byDay.get(day) ?? []), item])
  }

  return (
    <div className="space-y-6">
      {/* Top View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/content-calendar?view=calendar"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-data rounded transition-all',
              activeView === 'calendar'
                ? 'bg-[var(--surface-subtle)] text-white font-semibold border-b-2 border-[#E5252A]'
                : 'text-[var(--text-muted-hex)] hover:text-white'
            )}
          >
            <Grid className="h-3.5 w-3.5 text-[#E5252A]" />
            <span>Interactive 30-Day Grid Hub</span>
          </Link>

          <Link
            href="/dashboard/content-calendar?view=list"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-data rounded transition-all',
              activeView === 'list'
                ? 'bg-[var(--surface-subtle)] text-white font-semibold border-b-2 border-[#E5252A]'
                : 'text-[var(--text-muted-hex)] hover:text-white'
            )}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Operational List Feed ({items.length})</span>
          </Link>
        </div>

        {canManage && clients.length > 0 && <PostScheduleDialog clients={clients} />}
      </div>

      {activeView === 'calendar' ? (
        <SocialCalendarHub clients={clients} />
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {WINDOW_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/dashboard/content-calendar?view=list&window=${tab.value}`}
                className={cn(
                  'px-3 py-1 rounded text-xs font-mono-data transition-colors',
                  window === tab.value
                    ? 'bg-[#E5252A]/20 text-[var(--danger-text-hex)] border border-[#E5252A]/40 font-semibold'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-muted-hex)] hover:text-white'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>

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
            <div className="space-y-4">
              {Array.from(byDay.entries()).map(([day, dayItems]) => (
                <section key={day} className="space-y-2">
                  <h2 className="text-xs font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)] pl-1">
                    {formatDay(day)}
                  </h2>
                  {dayItems.map((item) => (
                    <div key={item.id} className="terminal-card p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/clients/${item.clientId}`}
                            className="text-sm font-medium text-[var(--text-primary-hex)] hover:text-[#E5252A]"
                          >
                            {item.client?.name ?? item.clientId}
                          </Link>
                          <span className="text-xs font-mono-data text-[var(--text-faint-hex)] uppercase">
                            · {item.platform}
                          </span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      {item.caption && <p className="text-xs text-[var(--text-primary-hex)]">{item.caption}</p>}
                      {item.providerPostId && (
                        <p className="text-[10px] font-mono-data text-[var(--text-faint-hex)]">
                          Metricool draft id: {item.providerPostId}
                        </p>
                      )}

                      {canManage && (item.status === 'IDEA' || item.status === 'DRAFT') && (
                        <ActionForm
                          action={submitContentForReviewAction.bind(null, item.id, item.clientId)}
                          className="mt-3"
                        >
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
                        <ActionForm
                          action={scheduleContentItemAction.bind(null, item.id, item.clientId)}
                          className="mt-3 space-y-2"
                        >
                          <fieldset>
                            <legend className="mb-1.5 text-xs font-medium text-[var(--text-muted-hex)]">
                              Schedule to networks
                            </legend>
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                              {NETWORKS.map((network) => (
                                <label
                                  key={network}
                                  className="flex items-center gap-1.5 text-xs text-[var(--text-primary-hex)] cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    name="networks"
                                    value={network}
                                    defaultChecked={network === item.platform.toLowerCase()}
                                    className="rounded border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[#E5252A]"
                                  />
                                  <span>{network}</span>
                                </label>
                              ))}
                            </div>
                            <FieldError name="networks" />
                          </fieldset>
                          <SubmitButton size="sm" pendingLabel="Scheduling…">
                            <CalendarDays className="h-3.5 w-3.5" /> Schedule to Channels
                          </SubmitButton>
                        </ActionForm>
                      )}

                      {canManage && item.status === 'SCHEDULED' && (
                        item.approvalId ? (
                          <p className="mt-2 text-xs text-[var(--text-muted-hex)]">
                            Publish requested - awaiting approval on{' '}
                            <Link href="/dashboard/approvals" className="text-[#E5252A] hover:underline">
                              Approvals Gate
                            </Link>.
                          </p>
                        ) : (
                          <ActionForm
                            action={publishContentItemAction.bind(null, item.id, item.clientId)}
                            className="mt-2"
                          >
                            <SubmitButton size="sm" pendingLabel="Requesting publish…">
                              <Upload className="h-3.5 w-3.5" /> Publish Immediately
                            </SubmitButton>
                          </ActionForm>
                        )
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
