import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Play, Check, Ban, RotateCcw, XCircle } from 'lucide-react'
import type { TaskStatus } from '@prisma/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { updateTaskStatusAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'

const STATUS_TABS: Array<{ value: string; label: string; status?: TaskStatus }> = [
  { value: 'open', label: 'Open', status: 'OPEN' },
  { value: 'in-progress', label: 'In progress', status: 'IN_PROGRESS' },
  { value: 'blocked', label: 'Blocked', status: 'BLOCKED' },
  { value: 'done', label: 'Done', status: 'DONE' },
  { value: 'all', label: 'All' },
]

/** Every transition a task can take from each state - nothing is a dead end. */
const TRANSITIONS: Record<TaskStatus, Array<{ status: TaskStatus; label: string; icon: typeof Play; primary?: boolean }>> = {
  OPEN: [
    { status: 'IN_PROGRESS', label: 'Start', icon: Play, primary: true },
    { status: 'BLOCKED', label: 'Block', icon: Ban },
    { status: 'CANCELLED', label: 'Cancel', icon: XCircle },
  ],
  IN_PROGRESS: [
    { status: 'DONE', label: 'Mark done', icon: Check, primary: true },
    { status: 'BLOCKED', label: 'Block', icon: Ban },
    { status: 'OPEN', label: 'Back to open', icon: RotateCcw },
  ],
  BLOCKED: [
    { status: 'IN_PROGRESS', label: 'Unblock and start', icon: Play, primary: true },
    { status: 'OPEN', label: 'Back to open', icon: RotateCcw },
    { status: 'CANCELLED', label: 'Cancel', icon: XCircle },
  ],
  DONE: [{ status: 'OPEN', label: 'Reopen', icon: RotateCcw }],
  CANCELLED: [{ status: 'OPEN', label: 'Reopen', icon: RotateCcw }],
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status: statusParam }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const tab = STATUS_TABS.find((t) => t.value === statusParam) ?? STATUS_TABS[0]!
  const tasks = await listTasksForOrg(ctx, { status: tab.status, limit: 100 })
  const canUpdate = ctx.permissions.has('tasks.create')

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Work items across every client, newest first." />

      <FilterTabs param="status" value={tab.value} options={STATUS_TABS} basePath="/dashboard/tasks" />

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={tab.value === 'open' ? 'No open tasks' : 'No tasks here'}
          description="Tasks are created from accepted recommendations - accept one under Recommendations and it appears here."
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/dashboard/clients/${task.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                    {task.client?.name ?? task.clientId}
                  </Link>
                  <p className="text-sm text-muted-foreground">{task.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                    {task.dueDate && <span className="text-xs tabular-nums text-caption">Due {task.dueDate.toISOString().slice(0, 10)}</span>}
                  </div>
                </div>
                {canUpdate && (
                  <div className="flex flex-wrap gap-1.5">
                    {TRANSITIONS[task.status].map((t) => {
                      const Icon = t.icon
                      return (
                        <ActionForm key={t.status} action={updateTaskStatusAction.bind(null, task.id, task.clientId, t.status)}>
                          <SubmitButton variant={t.primary ? 'outline' : 'ghost'} size="sm" pendingLabel="Saving…">
                            <Icon className="h-3.5 w-3.5" /> {t.label}
                          </SubmitButton>
                        </ActionForm>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
