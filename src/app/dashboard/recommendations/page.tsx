import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb, Check } from 'lucide-react'
import type { RecommendationStatus } from '@prisma/client'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { acceptRecommendationAction, rejectRecommendationAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { RejectWithReason } from '@/components/ui/reject-with-reason'

const STATUS_TABS: Array<{ value: string; label: string; status?: RecommendationStatus }> = [
  { value: 'open', label: 'To review', status: 'RECOMMENDED' },
  { value: 'accepted', label: 'Accepted', status: 'ACCEPTED' },
  { value: 'rejected', label: 'Rejected', status: 'REJECTED' },
  { value: 'all', label: 'All' },
]

export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status: statusParam }, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const tab = STATUS_TABS.find((t) => t.value === statusParam) ?? STATUS_TABS[0]!
  const recommendations = await listRecommendationsForOrg(ctx, { status: tab.status, limit: 100 })
  const canDecide = ctx.permissions.has('recommendations.review')

  return (
    <div className="space-y-6">
      <PageHeader title="Recommendations" description="Everything Claude has found across every client, newest first." />

      <FilterTabs param="status" value={tab.value} options={STATUS_TABS} basePath="/dashboard/recommendations" />

      {recommendations.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={tab.value === 'open' ? 'Nothing to review' : 'No recommendations here'}
          description={
            tab.value === 'open'
              ? 'New findings appear here after an analysis. Open a client and choose "Analyze this client" to generate some.'
              : 'Switch tabs to see recommendations in other states.'
          }
        />
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Card key={rec.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/clients/${rec.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {rec.client?.name ?? rec.clientId}
                    </Link>
                    <StatusBadge status={rec.priority} />
                    <span className="text-xs text-caption">{rec.area}</span>
                  </div>
                  <StatusBadge status={rec.status} />
                </div>
                <p className="mt-2 text-sm text-foreground">{rec.finding}</p>
                <p className="mt-1 text-sm text-muted-foreground">→ {rec.recommendation}</p>
                {rec.status === 'REJECTED' && rec.rejectionReason && (
                  <p className="mt-1 text-xs text-caption">Rejected: {rec.rejectionReason}</p>
                )}

                {canDecide && rec.status === 'RECOMMENDED' && (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <ActionForm action={acceptRecommendationAction.bind(null, rec.id, rec.clientId)}>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Accepting…">
                        <Check className="h-3.5 w-3.5" /> Accept
                      </SubmitButton>
                    </ActionForm>
                    <RejectWithReason action={rejectRecommendationAction.bind(null, rec.id, rec.clientId)} />
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
