import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getClientBrainSection, getClientPolicy } from '@/lib/clients/brain'
import type { MarketingSectionSchema } from '@/lib/clients/brain-schemas'
import type { z } from 'zod'
import { updateBrainSectionAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { Field } from '@/components/clients/section'
import { MARKETING_CHANNELS } from '@/lib/clients/options'

type Marketing = z.infer<typeof MarketingSectionSchema>
const joinLines = (v?: string[]) => v?.join('\n') ?? ''

/**
 * Marketing tab: the Client Brain's `marketing` section plus a read-only
 * view of the budget/approval policy currently in force (full policy
 * editing lives on Settings, since it's authorization-sensitive, not
 * narrative context for the AI).
 */
export default async function ClientMarketingPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [section, policy] = await Promise.all([
    getClientBrainSection(ctx, clientId, 'marketing') as Promise<Marketing | null>,
    getClientPolicy(ctx, clientId),
  ])
  const marketing = section ?? ({} as Marketing)
  const canEdit = ctx.permissions.has('clients.edit')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objectives & strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateBrainSectionAction.bind(null, clientId, 'marketing')} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Objectives" htmlFor="marketing-objectives" hint="One per line.">
              <Textarea id="marketing-objectives" name="brain.marketing.objectives" rows={3} defaultValue={joinLines(marketing.objectives)} disabled={!canEdit} />
            </Field>
            <Field label="Primary KPIs" htmlFor="marketing-kpis" hint="One per line.">
              <Textarea id="marketing-kpis" name="brain.marketing.kpis" rows={3} defaultValue={joinLines(marketing.kpis)} disabled={!canEdit} />
            </Field>
            <Field label="Target channels" htmlFor="marketing-channels" className="sm:col-span-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {MARKETING_CHANNELS.map((channel) => (
                  <label key={channel} className="flex items-center gap-1.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="brain.marketing.targetChannels"
                      value={channel}
                      defaultChecked={marketing.targetChannels?.includes(channel)}
                      disabled={!canEdit}
                      className="h-4 w-4 rounded border-input"
                    />
                    {channel.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Monthly ad budget" htmlFor="marketing-budget">
              <input type="hidden" name="brain.marketing.monthlyBudget" value={marketing.monthlyBudget ?? ''} />
              <p className="pt-1.5 text-sm text-foreground">{marketing.monthlyBudget != null ? `$${marketing.monthlyBudget.toLocaleString()}` : '—'}</p>
              <p className="mt-1 text-xs text-caption">Edit from Settings → General.</p>
            </Field>
            <Field label="Campaign history" htmlFor="marketing-history">
              <Textarea id="marketing-history" name="brain.marketing.campaignHistory" rows={3} defaultValue={marketing.campaignHistory ?? ''} disabled={!canEdit} />
            </Field>
            <Field label="Current priorities" htmlFor="marketing-priorities" className="sm:col-span-2" hint="One per line.">
              <Textarea id="marketing-priorities" name="brain.marketing.currentPriorities" rows={3} defaultValue={joinLines(marketing.currentPriorities)} disabled={!canEdit} />
            </Field>
            {canEdit && (
              <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Saving…">Save marketing profile</SubmitButton>
              </div>
            )}
          </ActionForm>
        </CardContent>
      </Card>

      {policy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current policy limits</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-caption">Max daily ad budget</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.maxDailyAdBudget?.toString() ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Max change per action</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.maxBudgetChangePercent != null ? `${policy.maxBudgetChangePercent}%` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Auto-publish social</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.autoPublishSocial ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Approval for launches</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.requireApprovalForCampaignLaunch ? 'Required' : 'Not required'}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-caption">Edit budget and approval policy from Settings → Automation.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
