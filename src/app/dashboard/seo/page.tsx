import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Search, Check, X } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listSeoRecommendationsForOrg } from '@/lib/seo/persist'
import { acceptRecommendationAction, rejectRecommendationAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * SEO (BRD-PRD Section 85's Phase 2 "SEO workflows" - the SEO Agent listed
 * as "Later" in Section 25, built now). Shows every recommendation the SEO
 * Agent has produced across every client the caller can see - a scoped
 * subset of what /dashboard/recommendations shows, identified via
 * `src/lib/seo/persist.ts` (the underlying AiRun's agentKey, not the
 * free-text `area` field). Running a new analysis happens from a client's
 * detail page ("Run SEO analysis", next to "Analyze this client") - a
 * client is already in scope there, same split as every other
 * client-scoped trigger in this app.
 */
export default async function SeoPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const recommendations = await listSeoRecommendationsForOrg(ctx, { limit: 100 })
  const canDecide = ctx.permissions.has('recommendations.review')

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO"
        description="Search Console findings and recommendations across every client, newest first."
      />

      {recommendations.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No SEO recommendations yet"
          description="Run an SEO analysis from a client's page to generate some."
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
