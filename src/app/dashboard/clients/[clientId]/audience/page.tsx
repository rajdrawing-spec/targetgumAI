import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getClientBrainSection } from '@/lib/clients/brain'
import type { AudienceSectionSchema } from '@/lib/clients/brain-schemas'
import type { z } from 'zod'
import { updateBrainSectionAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { Field } from '@/components/clients/section'

type Audience = z.infer<typeof AudienceSectionSchema>
const joinLines = (v?: string[]) => v?.join('\n') ?? ''
const joinPersonas = (v?: Audience['personas']) => v?.map((p) => p.name).join('\n') ?? ''

export default async function ClientAudiencePage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const audience = ((await getClientBrainSection(ctx, clientId, 'audience')) ?? {}) as Audience
  const canEdit = ctx.permissions.has('clients.edit')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audience</CardTitle>
      </CardHeader>
      <CardContent>
        <ActionForm action={updateBrainSectionAction.bind(null, clientId, 'audience')} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Primary personas" htmlFor="audience-personas" hint="One per line.">
            <Textarea id="audience-personas" name="brain.audience.personas" rows={3} defaultValue={joinPersonas(audience.personas)} disabled={!canEdit} />
          </Field>
          <Field label="Demographics" htmlFor="audience-demographics">
            <Textarea id="audience-demographics" name="brain.audience.demographics" rows={3} defaultValue={audience.demographics ?? ''} disabled={!canEdit} />
          </Field>
          <Field label="Pain points" htmlFor="audience-pain" hint="One per line.">
            <Textarea id="audience-pain" name="brain.audience.painPoints" rows={3} defaultValue={joinLines(audience.painPoints)} disabled={!canEdit} />
          </Field>
          <Field label="Motivations" htmlFor="audience-motivations" hint="One per line.">
            <Textarea id="audience-motivations" name="brain.audience.motivations" rows={3} defaultValue={joinLines(audience.motivations)} disabled={!canEdit} />
          </Field>
          <Field label="Buyer journey" htmlFor="audience-journey">
            <Textarea id="audience-journey" name="brain.audience.buyingJourney" rows={3} defaultValue={audience.buyingJourney ?? ''} disabled={!canEdit} />
          </Field>
          <Field label="Common objections" htmlFor="audience-objections" hint="One per line.">
            <Textarea id="audience-objections" name="brain.audience.objections" rows={3} defaultValue={joinLines(audience.objections)} disabled={!canEdit} />
          </Field>
          {canEdit && (
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Saving…">Save audience profile</SubmitButton>
            </div>
          )}
        </ActionForm>
      </CardContent>
    </Card>
  )
}
