import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb, Check, X } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { acceptRecommendationAction, rejectRecommendationAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default async function RecommendationsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const recommendations = await listRecommendationsForOrg(ctx, { limit: 100 })
  const canDecide = ctx.permissions.has('recommendations.review')

  return (
    <div className="space-y-6">
      <PageHeader title="Recommendations" description="Everything Claude has found across every client, newest first." />

      {recommendations.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No recommendations yet" description="Run an analysis from a client's page to generate some." />
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Card key={rec.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/clients/${rec.clientId}`} className="text-sm font-semibold text-foreground hover:text-primary">
                      {rec.client?.name ?? rec.clientId}
                    </Link>
                    <StatusBadge status={rec.priority} />
                    <span className="text-xs text-muted-foreground">{rec.area}</span>
                  </div>
                  <StatusBadge status={rec.status} />
                </div>
                <p className="mt-2 text-sm text-foreground">{rec.finding}</p>
                <p className="mt-1 text-sm text-muted-foreground">→ {rec.recommendation}</p>

                {canDecide && rec.status === 'RECOMMENDED' && (
                  <div className="mt-3 flex gap-2">
                    <form action={acceptRecommendationAction.bind(null, rec.id, rec.clientId)}>
                      <Button type="submit" variant="outline" size="sm">
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                    </form>
                    <form action={rejectRecommendationAction.bind(null, rec.id, rec.clientId, 'Rejected from dashboard.')}>
                      <Button type="submit" variant="ghost" size="sm">
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </form>
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
