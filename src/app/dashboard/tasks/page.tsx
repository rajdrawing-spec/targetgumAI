import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listTasksForOrg } from '@/lib/recommendations/tasks'
import { updateTaskStatusAction } from '../actions'

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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tasks</h1>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400">No tasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const next = NEXT_STATUS[task.status]
            return (
              <li key={task.id} className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm">
                <div>
                  <Link href={`/dashboard/clients/${task.clientId}`} className="font-medium hover:underline">
                    {task.client?.name ?? task.clientId}
                  </Link>
                  <span className="text-gray-500"> — {task.title}</span>
                  <div className="text-xs text-gray-400">
                    {task.priority} · {task.status}
                  </div>
                </div>
                {canUpdate && next && (
                  <form action={updateTaskStatusAction.bind(null, task.id, task.clientId, next.status)}>
                    <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                      {next.label}
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
