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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * Social content calendar (BRD Section 66/48, Phase 2 Section 85). Shows
 * every ContentCalendarItem across every client the caller can see, with
 * the status-transition actions available at each stage. Creating a new
 * item happens from a specific client's detail page (a client is already
 * in scope there) - same split as Recommendations/Tasks: this aggregate
 * page owns the action buttons, the client page owns creation + a
 * read-only view.
 */
export default async function ContentCalendarPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const items = await listContentCalendarItemsForOrg(ctx, { limit: 100 })
  const canManage = ctx.permissions.has('content.manage')

  return (
    <div className="space-y-6">
      <PageHeader title="Content calendar" description="Draft, review, and schedule social posts across every client." />

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No content planned yet"
          description="Add a post from a client's page to get started."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/clients/${item.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {item.client?.name ?? item.clientId}
                    </Link>
                    <span className="text-xs text-caption">{item.platform}</span>
                    <span className="text-xs tabular-nums text-caption">{item.publishDate.toISOString().slice(0, 10)}</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                {item.caption && <p className="mt-2 text-sm text-foreground">{item.caption}</p>}
                {item.providerPostId && (
                  <p className="mt-1 text-xs text-caption">Metricool draft id: {item.providerPostId}</p>
                )}

                {canManage && (item.status === 'IDEA' || item.status === 'DRAFT') && (
                  <form action={submitContentForReviewAction.bind(null, item.id, item.clientId)} className="mt-3">
                    <Button type="submit" variant="outline" size="sm">
                      <Send className="h-3.5 w-3.5" /> Submit for review
                    </Button>
                  </form>
                )}

                {canManage && item.status === 'IN_REVIEW' && (
                  <div className="mt-3 flex gap-2">
                    <form action={approveContentItemAction.bind(null, item.id, item.clientId)}>
                      <Button type="submit" size="sm">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </form>
                    <form action={cancelContentItemAction.bind(null, item.id, item.clientId)}>
                      <Button type="submit" variant="ghost" size="sm">
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </form>
                  </div>
                )}

                {canManage && item.status === 'APPROVED' && (
                  <form action={scheduleContentItemAction.bind(null, item.id, item.clientId)} className="mt-3 flex flex-wrap items-end gap-2">
                    <div>
                      <label htmlFor={`networks-${item.id}`} className="mb-1.5 block text-xs font-medium text-caption">
                        Networks (comma-separated)
                      </label>
                      <Input id={`networks-${item.id}`} name="networks" type="text" required placeholder="instagram,facebook" className="w-56" />
                    </div>
                    <Button type="submit" size="sm">
                      <CalendarDays className="h-3.5 w-3.5" /> Schedule
                    </Button>
                  </form>
                )}

                {canManage && item.status === 'SCHEDULED' && (
                  item.approvalId ? (
                    <p className="mt-3 text-xs text-caption">
                      Publish requested - waiting on approval. Check the{' '}
                      <Link href="/dashboard/approvals" className="text-primary hover:underline">Approvals</Link> page.
                    </p>
                  ) : (
                    <form action={publishContentItemAction.bind(null, item.id, item.clientId)} className="mt-3">
                      <Button type="submit" size="sm">
                        <Upload className="h-3.5 w-3.5" /> Publish
                      </Button>
                    </form>
                  )
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
