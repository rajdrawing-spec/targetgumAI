import Link from 'next/link'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/dashboard/actions'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { EmptyState } from '@/components/ui/empty-state'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface NotificationBellItem {
  id: string
  title: string
  body: string | null
  link: string | null
  readAt: Date | null
  createdAt: Date
}

/**
 * The header notification bell (BRD Section 64). A Server Component by
 * design, open/close driven by a hidden checkbox + `peer-checked:` +
 * `<label htmlFor>` - the exact same no-JS disclosure pattern
 * `layout.tsx`'s mobile nav drawer already uses (a `<label for>` can
 * natively toggle a checkbox off, which a plain `<details>` has no
 * equivalent for without a client-side click handler). Only the "mark as
 * read" buttons inside are interactive, and those are just `ActionForm`s.
 *
 * Data (`unreadCount`/`items`) is fetched once by the layout per request -
 * good enough for an MVP inbox; there is no live push here (BRD Section
 * 64's "in-app" support is what's implemented, not real-time delivery).
 */
export function NotificationBell({ unreadCount, items }: { unreadCount: number; items: NotificationBellItem[] }) {
  return (
    <div className="relative">
      <input type="checkbox" id="notification-bell-toggle" className="peer hidden" />

      <label
        htmlFor="notification-bell-toggle"
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-faint-hex)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)]"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <span className="relative flex">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E5252A] px-1 text-[9px] font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
      </label>

      {/* Backdrop - a <label for> click natively unchecks the same toggle, closing the panel with no JS. */}
      <label
        htmlFor="notification-bell-toggle"
        aria-hidden
        className="fixed inset-0 z-40 hidden cursor-default peer-checked:block"
      />

      <div className="invisible absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right scale-95 overflow-hidden rounded-md border border-[var(--border-hairline)] bg-[var(--surface-base)] opacity-0 shadow-lg transition-[opacity,transform] duration-100 peer-checked:visible peer-checked:scale-100 peer-checked:opacity-100">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted-hex)]">Notifications</span>
          {unreadCount > 0 && (
            <ActionForm action={markAllNotificationsReadAction}>
              <SubmitButton variant="ghost" size="sm" pendingLabel="Marking…" className="h-6 gap-1 px-1.5 text-[11px]">
                <CheckCheck className="h-3 w-3" /> Mark all read
              </SubmitButton>
            </ActionForm>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <EmptyState icon={Bell} title="Nothing yet" description="You'll see approvals, workflow failures, and high-priority findings here." />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-2 border-b border-[var(--border-hairline)] px-3 py-2.5 last:border-b-0',
                  !item.readAt && 'bg-[var(--surface-subtle)]',
                )}
              >
                <Link href={item.link ?? '/dashboard/notifications'} className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary-hex)]">{item.title}</p>
                  {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted-hex)]">{item.body}</p>}
                  <p className="mt-1 text-[10px] text-[var(--text-faint-hex)]">{formatRelative(item.createdAt)}</p>
                </Link>
                {!item.readAt && (
                  <ActionForm action={markNotificationReadAction.bind(null, item.id)}>
                    <SubmitButton
                      variant="ghost"
                      size="icon"
                      pendingLabel={<Check className="h-3 w-3" />}
                      title="Mark as read"
                      className="h-6 w-6 shrink-0"
                    >
                      <Check className="h-3 w-3" />
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            ))
          )}
        </div>

        <Link
          href="/dashboard/notifications"
          className="block border-t border-[var(--border-hairline)] px-3 py-2 text-center text-xs font-medium text-[var(--text-secondary-hex)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)]"
        >
          View all
        </Link>
      </div>
    </div>
  )
}
