import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getClientBrainSection } from '@/lib/clients/brain'
import type { BusinessSectionSchema } from '@/lib/clients/brain-schemas'
import type { z } from 'zod'
import { updateBrainSectionAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { Field } from '@/components/clients/section'

type Business = z.infer<typeof BusinessSectionSchema>
const joinLines = (v?: string[]) => v?.join('\n') ?? ''

/**
 * The Business tab is the Client Brain's `business` section, editable
 * directly - this is what the AI Gateway actually reads on every analysis
 * (src/lib/clients/context-router.ts), not a separate document that
 * happens to look similar (BRD "users need to understand what the AI
 * knows about the client").
 */
export default async function ClientBusinessPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const section = ((await getClientBrainSection(ctx, clientId, 'business')) ?? {}) as Business
  const canEdit = ctx.permissions.has('clients.edit')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Business</CardTitle>
      </CardHeader>
      <CardContent>
        <ActionForm action={updateBrainSectionAction.bind(null, clientId, 'business')} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Products / services" htmlFor="business-products" className="sm:col-span-2">
            <Textarea id="business-products" name="brain.business.productsServices" rows={3} defaultValue={section.productsServices ?? ''} disabled={!canEdit} />
          </Field>
          <Field label="Locations served" htmlFor="business-locations" hint="One per line.">
            <Textarea id="business-locations" name="brain.business.locations" rows={3} defaultValue={joinLines(section.locations)} disabled={!canEdit} />
          </Field>
          <Field label="Business model" htmlFor="business-model">
            <Textarea id="business-model" name="brain.business.businessModel" rows={3} defaultValue={section.businessModel ?? ''} disabled={!canEdit} />
          </Field>
          <Field label="Pricing" htmlFor="business-pricing">
            <Textarea id="business-pricing" name="brain.business.pricing" rows={3} defaultValue={section.pricing ?? ''} disabled={!canEdit} />
          </Field>
          <Field label="Key offers" htmlFor="business-offers">
            <Textarea id="business-offers" name="brain.business.offers" rows={3} defaultValue={section.offers ?? ''} disabled={!canEdit} />
          </Field>
          <Field label="Business goals" htmlFor="business-goals" className="sm:col-span-2" hint="One per line.">
            <Textarea id="business-goals" name="brain.business.businessGoals" rows={3} defaultValue={joinLines(section.businessGoals)} disabled={!canEdit} />
          </Field>
          {canEdit && (
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Saving…">Save business profile</SubmitButton>
            </div>
          )}
        </ActionForm>
      </CardContent>
    </Card>
  )
}
