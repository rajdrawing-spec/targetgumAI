import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAuditEvents } from '@/lib/audit/record'

const RESULT_STYLE: Record<string, string> = {
  SUCCESS: 'bg-green-50 text-green-700',
  FAILURE: 'bg-red-50 text-red-700',
  DENIED: 'bg-amber-50 text-amber-700',
}

/**
 * BRD-PRD Section 28. `listAuditEvents` requires `audit.read` - only
 * super_admin holds it by default (Section 4.1), so most viewers land here
 * and get the Day 14 error boundary's clean "Missing permission" message
 * instead of a crash - itself part of Day 14's "error states" coverage.
 */
export default async function AuditPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const events = await listAuditEvents(ctx, { limit: 200 })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit trail</h1>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">No audit events yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500">
            <tr>
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Action</th>
              <th className="pb-2 font-medium">Result</th>
              <th className="pb-2 font-medium">Provider / tool</th>
              <th className="pb-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((event) => (
              <tr key={event.id}>
                <td className="py-2 text-gray-500">{event.timestamp.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td className="py-2">{event.action}</td>
                <td className="py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${RESULT_STYLE[event.result] ?? 'bg-gray-100 text-gray-600'}`}>
                    {event.result}
                  </span>
                </td>
                <td className="py-2 text-gray-500">{[event.provider, event.tool].filter(Boolean).join(' / ') || '—'}</td>
                <td className="py-2 text-gray-500">{event.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
