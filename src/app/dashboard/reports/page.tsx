import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listReportsForOrg } from '@/lib/reports/generate'

export default async function ReportsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const reports = await listReportsForOrg(ctx, { limit: 100 })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      {reports.length === 0 ? (
        <p className="text-sm text-gray-400">No reports yet — run an analysis from a client page.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {reports.map((report) => (
            <li key={report.id}>
              <Link href={`/dashboard/reports/${report.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium">{report.title}</div>
                  <div className="text-xs text-gray-500">{report.client?.name ?? report.clientId}</div>
                </div>
                <span className="text-xs text-gray-500">
                  {report.type} · {report.periodStart.toISOString().slice(0, 10)} – {report.periodEnd.toISOString().slice(0, 10)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
