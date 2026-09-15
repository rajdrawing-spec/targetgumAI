import { z } from 'zod/v4'
import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import type { AuthContext } from '@/lib/rbac/types'
import { registerAgent } from '@/lib/agents/registry'

/**
 * The guided "Create Ad Campaign" wizard's AI step. Turns three plain-
 * language answers (what the campaign is about, which platform, budget +
 * audience) into a reviewable campaign brief - a name, a plain-language
 * strategy explanation, and one draft ad. Nothing here executes anything:
 * this agent's tool allowlist is empty, same as the Competitor and
 * Creative agents (BRD Section 19 - a brief is a proposal for a human to
 * review, never an already-running campaign). Turning an accepted brief
 * into a real, paused campaign is a separate, deterministic step -
 * `launchCampaignFromWizard` (./launch.ts) - mirroring how the Creative
 * Agent's concepts and `generateCreativeDesign` are two separate steps.
 */

export const CAMPAIGN_BRIEF_AGENT_KEY = 'campaign_brief'

export async function registerCampaignBriefAgent(): Promise<void> {
  await registerAgent({
    key: CAMPAIGN_BRIEF_AGENT_KEY,
    name: 'Campaign Brief Agent',
    purpose:
      "Turns a client's plain-language answers (what to advertise, which platform, budget, audience) into a reviewable campaign brief - a name, plain-language strategy note, and one draft ad concept.",
    allowedToolKeys: [],
  })
}

export const AdConceptSchema = z.object({
  headline: z.string().describe('Short, attention-grabbing headline'),
  primaryText: z.string().describe('The actual ad copy - 1-3 sentences'),
  visualDirection: z.string().describe('What the accompanying image or video should show'),
})

export const CampaignBriefSchema = z.object({
  campaignName: z.string(),
  recommendedProvider: z
    .enum(['META_ADS', 'GOOGLE_ADS', 'AMAZON_ADS'])
    .optional()
    .describe('Only set when the platform was genuinely undecided - otherwise leave unset'),
  strategyNote: z.string().describe('2-4 plain-language sentences explaining the approach - no jargon'),
  audienceSummary: z.string().describe('Who the ads will realistically reach, grounded only in what was provided'),
  budgetAssessment: z
    .string()
    .describe('Honest comment on whether the budget fits the goal/platform - never a fabricated outcome number'),
  adConcept: AdConceptSchema,
})

export type CampaignBrief = z.infer<typeof CampaignBriefSchema>

export interface GenerateCampaignBriefInput {
  ctx: AuthContext
  clientId: string
  /** What the campaign is about, in the user's own words (product/service, offer, goal). */
  about: string
  /** The plain-language goal the user picked (e.g. "Get more sales"). */
  goal: string
  /** Either a chosen provider, or 'AI_RECOMMEND' when the user isn't sure and only connected platforms should be considered. */
  platformChoice: 'META_ADS' | 'GOOGLE_ADS' | 'AMAZON_ADS' | 'AI_RECOMMEND'
  /** Providers actually connected for this client - constrains what the AI is allowed to recommend. */
  connectedProviders: Array<'META_ADS' | 'GOOGLE_ADS' | 'AMAZON_ADS'>
  dailyBudget: number
  /** Who they're trying to reach, in their own words - optional, plain language. */
  audience?: string
}

export interface GenerateCampaignBriefResult {
  brief: CampaignBrief
  aiRunId: string
}

export async function generateCampaignBrief(input: GenerateCampaignBriefInput): Promise<GenerateCampaignBriefResult> {
  const { ctx, clientId } = input
  // Self-registering rather than relying on ensureToolsRegistered() (which
  // only ever runs as a side effect of some *other* code path calling
  // executeTool first) - this agent never calls a tool, so nothing else
  // guarantees its Agent row exists before this runs. Idempotent, cheap.
  await registerCampaignBriefAgent()
  const context = await assembleClientContext(ctx, clientId, 'campaign')

  const platformLine =
    input.platformChoice === 'AI_RECOMMEND'
      ? `Platform: not decided yet - recommend one from exactly these connected options: ${input.connectedProviders.join(', ')}.`
      : `Platform: ${input.platformChoice} (already chosen - do not second-guess it, do not set recommendedProvider).`

  const userMessage = [
    renderContextAsText(context),
    '\n--- This campaign, in the client\'s own words ---',
    `What it's about: ${input.about}`,
    `Goal: ${input.goal}`,
    platformLine,
    `Daily budget: $${input.dailyBudget}`,
    input.audience ? `Who they're trying to reach: ${input.audience}` : "Who they're trying to reach: not specified - infer a reasonable default from the business/goal, and say so in audienceSummary.",
  ].join('\n')

  const result = await runStructuredAiTask({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    agentKey: CAMPAIGN_BRIEF_AGENT_KEY,
    promptCategory: 'campaign-brief',
    variables: { client_name: context.client.name },
    userMessage,
    schema: CampaignBriefSchema,
  })

  return { brief: result.data, aiRunId: result.aiRunId }
}
