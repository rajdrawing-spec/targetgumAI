'use client'

import { CheckCircle2 } from 'lucide-react'
import type { BusinessSectionSchema } from '@/lib/clients/brain-schemas'
import type { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { Field } from '@/components/clients/section'
import type { ActionResult } from '@/lib/actions/result'
import { GummyMascot } from './mascot'

type Business = z.infer<typeof BusinessSectionSchema>
const joinLines = (v?: string[]) => v?.join('\n') ?? ''

type IntakeAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>

/**
 * Stage 1 of the Growth Map - "Define Your Business" - replacing what used
 * to be a quiz. Someone who has never done any marketing shouldn't be
 * tested on marketing terms before they've even described what they make
 * (docs/DECISIONS.md's "village potter" persona). Instead this is a plain-
 * language guided form: four questions in everyday words, each with a short
 * example, that write straight into the Client Brain's `business` section -
 * the same data the Business tab shows and the AI Gateway reads.
 *
 * Unlike the quiz stages this isn't a one-time gate - a business can change,
 * so the form stays open and resubmittable even after the stage is marked
 * complete.
 */
export function BusinessIntakeForm({
  business,
  completeAction,
  canWrite,
  alreadyCompleted,
}: {
  business: Business
  completeAction: IntakeAction
  canWrite: boolean
  alreadyCompleted: boolean
}) {
  return (
    <Card className="mx-auto max-w-xl overflow-hidden">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <GummyMascot className="h-14 w-12 shrink-0" />
          <div className="pt-1">
            <p className="text-base font-semibold leading-snug text-foreground">
              Tell us about your business - in your own words
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No marketing know-how needed. Just describe things the way you&apos;d tell a friend or a customer.
            </p>
          </div>
        </div>

        {alreadyCompleted && (
          <div className="flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1.5 text-xs font-semibold text-success w-fit">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved - you can update this anytime
          </div>
        )}

        <ActionForm action={completeAction} className="space-y-4">
          <Field label="What do you make or sell?" htmlFor="intake-products" hint="For example: &ldquo;I hand-throw clay pots and bowls with a blue glaze.&rdquo;">
            <Textarea
              id="intake-products"
              name="productsServices"
              rows={3}
              defaultValue={business.productsServices ?? ''}
              disabled={!canWrite}
              required
            />
          </Field>

          <Field label="What makes your work special?" htmlFor="intake-offers" hint="What would make someone pick you over someone else? Even something small counts.">
            <Textarea id="intake-offers" name="offers" rows={3} defaultValue={business.offers ?? ''} disabled={!canWrite} />
          </Field>

          <Field label="Where do people buy from you?" htmlFor="intake-locations" hint="Your shop, a market stall, a city, an online store - one per line.">
            <Textarea id="intake-locations" name="locations" rows={3} defaultValue={joinLines(business.locations)} disabled={!canWrite} />
          </Field>

          <Field label="What would you like this to help you achieve?" htmlFor="intake-goals" hint="For example: &ldquo;Get more people to know about my pottery&rdquo; or &ldquo;Sell more online&rdquo; - one per line.">
            <Textarea id="intake-goals" name="businessGoals" rows={3} defaultValue={joinLines(business.businessGoals)} disabled={!canWrite} />
          </Field>

          {canWrite && (
            <SubmitButton className="w-full" size="lg" pendingLabel="Saving…">
              Save my business info
            </SubmitButton>
          )}
        </ActionForm>
      </CardContent>
    </Card>
  )
}
