import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, ArrowRight } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { updateTaskStatusAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

const NEXT_STATUS: Record<string, { status: 'IN_PROGRESS' | 'DONE'; label: string } | undefined> = {
  OPEN: { status: 'IN_PROGRESS', label: 'Start' },
  IN_PROGRESS: { status: 'DONE', label: 'Mark done' },
}

export default async function TasksPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const tasks = await listTasksForOrg(ctx, { limit: 100 })
  const canUpdate = ctx.permissions.has('tasks.create')

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Work items across every client, newest first." />

      {tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks yet" />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const next = NEXT_STATUS[task.status]
            return (
              <Card key={task.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/dashboard/clients/${task.clientId}`} className="text-sm font-semibold text-foreground hover:text-primary">
                      {task.client?.name ?? task.clientId}
                    </Link>
                    <p className="text-sm text-muted-foreground">{task.title}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <StatusBadge status={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  {canUpdate && next && (
                    <form action={updateTaskStatusAction.bind(null, task.id, task.clientId, next.status)}>
                      <Button type="submit" variant="outline" size="sm">
                        {next.label} <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
