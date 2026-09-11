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
import { EmptyState } from '@/components/ui/empty-state'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'

/**
 * Creative asset review (BRD Section 67/85 Phase 2 - the Canva creative
 * workflow). Shows every `CreativeAsset` across every client the caller
 * can see, with the status-transition actions available at each stage.
 * Concept generation is triggered from a client's workspace.
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
          description="Open a client's workspace and use &quot;Generate concepts&quot; with a short campaign brief."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {assets.map((asset) => (
            <Card key={asset.id} className="flex flex-col">
              {asset.exportUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- provider-hosted asset, dimensions unknown
                <img src={asset.exportUrl} alt={asset.concept ?? 'Exported creative'} className="max-h-64 w-full rounded-t-lg object-cover" />
              ) : null}
              <CardContent className="flex flex-1 flex-col p-4">
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
                      Open in Canva →
                    </a>
                  </p>
                )}
                {!asset.designUrl && !asset.exportUrl && (
                  <p className="mt-1 text-xs text-caption">No design yet - this is a concept only.</p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  {canManage && !asset.designUrl && (asset.status === 'DRAFT' || asset.status === 'IN_REVIEW') && (
                    <ActionForm action={generateCreativeDesignAction.bind(null, asset.id, asset.clientId)}>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Generating design…">
                        <Sparkles className="h-3.5 w-3.5" /> Generate Canva design
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {canManage && asset.status === 'DRAFT' && (
                    <ActionForm action={submitCreativeForReviewAction.bind(null, asset.id, asset.clientId)}>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Submitting…">
                        <Send className="h-3.5 w-3.5" /> Submit for review
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {canManage && asset.status === 'IN_REVIEW' && (
                    <>
                      <ActionForm action={approveCreativeAction.bind(null, asset.id, asset.clientId)}>
                        <SubmitButton size="sm" pendingLabel="Approving…">
                          <Check className="h-3.5 w-3.5" /> Approve
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={rejectCreativeAction.bind(null, asset.id, asset.clientId)}>
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Rejecting…">
                          <X className="h-3.5 w-3.5" /> Reject
                        </SubmitButton>
                      </ActionForm>
                    </>
                  )}
                  {asset.status === 'APPROVED' && (
                    <p className="text-xs text-caption">
                      Approved - attach it to a post from{' '}
                      <Link href={`/dashboard/clients/${asset.clientId}`} className="text-primary hover:underline">
                        the client&apos;s workspace
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
