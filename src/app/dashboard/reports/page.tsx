import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listReportsForOrg } from '@/lib/reports/generate'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ReportsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const reports = await listReportsForOrg(ctx, { limit: 100 })

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generated performance reports across every client." />

      {reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports yet" description="Run an analysis from a client's page to generate one." />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/dashboard/reports/${report.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{report.title}</p>
                <p className="text-xs text-muted-foreground">{report.client?.name ?? report.clientId}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {report.periodStart.toISOString().slice(0, 10)} – {report.periodEnd.toISOString().slice(0, 10)}
                </span>
                <Badge variant="neutral">{report.type}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
