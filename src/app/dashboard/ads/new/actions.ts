'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { generateCampaignBrief, type CampaignBrief } from '@/lib/ads/campaign-brief'
import { launchCampaignFromWizard } from '@/lib/ads/launch'
import type { AdCampaignProvider } from '@/lib/ads/connected-providers'
import { answerWizardQuestion } from '@/lib/search/marketing-search'
import { AuthenticationError } from '@/lib/rbac/errors'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

export interface GenerateBriefActionInput {
  clientId: string
  about: string
  goal: string
  platformChoice: AdCampaignProvider | 'AI_RECOMMEND'
  connectedProviders: AdCampaignProvider[]
  dailyBudget: number
  audience?: string
}

export type GenerateBriefActionResult = { ok: true; brief: CampaignBrief; aiRunId: string } | { ok: false; error: string }

/**
 * The wizard's "generate my brief" step. Deliberately not an `ActionResult`/
 * `useActionState` action bound to a `<form>` - it's called directly from
 * the wizard's client component (same pattern as
 * `src/app/dashboard/search-actions.ts`'s `searchClientsForHeaderAction`),
 * since a "review this AI brief" step has nothing useful to do with the
 * pending/inline-error UI `ActionForm` renders - it needs the actual brief
 * object back so the review step can render and let the user edit it.
 */
export async function generateBriefAction(input: GenerateBriefActionInput): Promise<GenerateBriefActionResult> {
  try {
    const ctx = await requireCtx()
    const { brief, aiRunId } = await generateCampaignBrief({
      ctx,
      clientId: input.clientId,
      about: input.about,
      goal: input.goal,
      platformChoice: input.platformChoice,
      connectedProviders: input.connectedProviders,
      dailyBudget: input.dailyBudget,
      audience: input.audience,
    })
    return { ok: true, brief, aiRunId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not generate a campaign brief.' }
  }
}

export interface AskWizardHelpInput {
  clientId: string
  step: string
  formSoFar?: string
  question: string
}

export type AskWizardHelpResult = { ok: true; answer: string } | { ok: false; error: string }

/** The wizard's "not sure? ask" helper - same not-ActionResult shape as generateBriefAction, for the same reason. */
export async function askWizardHelpAction(input: AskWizardHelpInput): Promise<AskWizardHelpResult> {
  try {
    const ctx = await requireCtx()
    const { answer } = await answerWizardQuestion({
      ctx,
      clientId: input.clientId,
      step: input.step,
      formSoFar: input.formSoFar,
      question: input.question,
    })
    return { ok: true, answer }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not answer that right now.' }
  }
}

const launchSchema = z.object({
  clientId: z.string().min(1),
  provider: z.enum(['META_ADS', 'GOOGLE_ADS', 'AMAZON_ADS']),
  name: z.string().trim().min(1, 'Give the campaign a name.').max(200),
  dailyBudget: z.coerce.number().positive('Daily budget must be greater than zero.'),
  headline: z.string().trim().min(1).max(200),
  primaryText: z.string().trim().min(1).max(2000),
  visualDirection: z.string().trim().min(1).max(2000),
  aiRunId: z.string().optional(),
})

export async function launchCampaignAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('launch-campaign', async () => {
    const ctx = await requireCtx()
    const input = launchSchema.parse({
      clientId: formData.get('clientId'),
      provider: formData.get('provider'),
      name: formData.get('name'),
      dailyBudget: formData.get('dailyBudget'),
      headline: formData.get('headline'),
      primaryText: formData.get('primaryText'),
      visualDirection: formData.get('visualDirection'),
      aiRunId: formString(formData, 'aiRunId'),
    })

    const result = await launchCampaignFromWizard({
      ctx,
      clientId: input.clientId,
      provider: input.provider,
      name: input.name,
      dailyBudget: input.dailyBudget,
      adConcept: { headline: input.headline, primaryText: input.primaryText, visualDirection: input.visualDirection },
      aiRunId: input.aiRunId,
    })

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/clients/${input.clientId}`)
    revalidatePath('/dashboard/creatives')

    return actionOk(`"${input.name}" was created - paused, ready for you to review before it goes live.`, {
      redirectTo: `/dashboard/ads?highlight=${result.campaignId}`,
    })
  })
}
