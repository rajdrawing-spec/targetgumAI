import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Search, Check } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listSeoRecommendationsForOrg } from '@/lib/seo/persist'
import { acceptRecommendationAction, rejectRecommendationAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { RejectWithReason } from '@/components/ui/reject-with-reason'

/**
 * SEO (BRD-PRD Section 85's Phase 2 "SEO workflows"). Shows every
 * recommendation the SEO Agent has produced across every client the caller
 * can see, identified via `src/lib/seo/persist.ts` (the underlying AiRun's
 * agentKey). Running a new analysis happens from a client's workspace
 * ("Run SEO analysis").
 */
export default async function SeoPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const recommendations = await listSeoRecommendationsForOrg(ctx, { limit: 100 })
  const canDecide = ctx.permissions.has('recommendations.review')

  return (
    <div className="space-y-6">
      <PageHeader title="SEO" description="Recommendations from the SEO agent across every client, newest first." />

      {recommendations.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No SEO recommendations yet"
          description="Open a client and choose &quot;Run SEO analysis&quot; - it needs a Google Search Console connection for real data, and runs on mock data otherwise."
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
