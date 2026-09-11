import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check, Image as ImageIcon, Send, Sparkles, X } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listCreativeAssetsForOrg } from '@/lib/creative/persist'
import {
  approveCreativeAction,
  generateCreativeDesignAction,
  rejectCreativeAction,
  submitCreativeForReviewAction,
} from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * Creative asset review (BRD Section 67/85 Phase 2 - the Canva creative
 * workflow). Shows every `CreativeAsset` across every client the caller
 * can see, with the status-transition actions available at each stage -
 * same aggregate-page-owns-actions split as Content calendar/
 * Recommendations/Tasks: creation (triggering concept generation) happens
 * from a client's detail page, this page owns the review/approve/reject/
 * generate-design actions.
 */
export default async function CreativesPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const assets = await listCreativeAssetsForOrg(ctx, { limit: 100 })
  const canManage = ctx.permissions.has('creative.manage')

  return (
    <div className="space-y-6">
      <PageHeader title="Creatives" description="Review and approve AI-generated creative concepts before they become Canva designs." />

      {assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No creative concepts yet"
          description="Generate creative concepts from a client's page to get started."
        />
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/clients/${asset.clientId}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {asset.client?.name ?? asset.clientId}
                    </Link>
                    {asset.platform && <span className="text-xs text-caption">{asset.platform}</span>}
                  </div>
                  <StatusBadge status={asset.status} />
                </div>
                {asset.copy && <p className="mt-2 whitespace-pre-line text-sm text-foreground">{asset.copy}</p>}
                {asset.concept && <p className="mt-1 text-xs text-caption">Visual: {asset.concept}</p>}
                {asset.designUrl && (
                  <p className="mt-1 text-xs">
                    <a href={asset.designUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Continue editing in Canva →
                    </a>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {canManage && !asset.designUrl && (asset.status === 'DRAFT' || asset.status === 'IN_REVIEW') && (
                    <form action={generateCreativeDesignAction.bind(null, asset.id, asset.clientId)}>
                      <Button type="submit" variant="outline" size="sm">
                        <Sparkles className="h-3.5 w-3.5" /> Generate Canva design
                      </Button>
                    </form>
                  )}

                  {canManage && asset.status === 'DRAFT' && (
                    <form action={submitCreativeForReviewAction.bind(null, asset.id, asset.clientId)}>
                      <Button type="submit" variant="outline" size="sm">
                        <Send className="h-3.5 w-3.5" /> Submit for review
                      </Button>
                    </form>
                  )}

                  {canManage && asset.status === 'IN_REVIEW' && (
                    <>
                      <form action={approveCreativeAction.bind(null, asset.id, asset.clientId)}>
                        <Button type="submit" size="sm">
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                      </form>
                      <form action={rejectCreativeAction.bind(null, asset.id, asset.clientId)}>
                        <Button type="submit" variant="ghost" size="sm">
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </form>
                    </>
                  )}

                  {asset.status === 'APPROVED' && (
                    <p className="text-xs text-caption">
                      Approved - attach it to a post from a client&apos;s{' '}
                      <Link href={`/dashboard/clients/${asset.clientId}`} className="text-primary hover:underline">
                        content calendar form
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
