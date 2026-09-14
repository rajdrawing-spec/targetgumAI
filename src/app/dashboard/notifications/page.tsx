import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listNotificationsForUser } from '@/lib/notifications/service'
import { markAllNotificationsReadAction, markNotificationReadAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
]

/**
 * The full notification history (BRD Section 64) - the bell dropdown
 * (`NotificationBell`, `layout.tsx`) only ever shows the latest handful.
 * Always the caller's own notifications - `listNotificationsForUser`
 * filters by `ctx.userId` itself, never a query param.
 */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const unreadOnly = status === 'unread'
  const notifications = await listNotificationsForUser(ctx, { unreadOnly, limit: 200 })
  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Approvals, workflow failures, integration issues, and high-priority findings - as they happen." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs param="status" value={status} options={STATUS_TABS} basePath="/dashboard/notifications" />
        {unreadCount > 0 && (
          <ActionForm action={markAllNotificationsReadAction}>
            <SubmitButton variant="outline" size="sm" pendingLabel="Marking…">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description="You'll hear about approvals, workflow failures, integration issues, and high-priority findings here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={cn('p-4', !n.readAt && 'border-primary/40 bg-primary/[0.03]')}>
              <div className="flex items-start justify-between gap-3">
                <Link href={n.link ?? '/dashboard/notifications'} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.client && <span className="text-xs text-caption">· {n.client.name}</span>}
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1.5 text-xs tabular-nums text-caption">{formatRelative(n.createdAt)}</p>
                </Link>
                {!n.readAt && (
                  <ActionForm action={markNotificationReadAction.bind(null, n.id)}>
                    <SubmitButton variant="outline" size="sm" pendingLabel="…">
                      <Check className="h-3.5 w-3.5" /> Mark read
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
