import { z } from 'zod/v4'
import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import type { AuthContext } from '@/lib/rbac/types'
import { registerAgent } from './registry'

/**
 * The Creative Agent (BRD-PRD Section 25's MVP agent list "Creative Agent
 * — produces creative briefs and drives Canva MCP when available;
 * degrades to brief-only output when it isn't", Section 47's "MVP
 * Creative Workflow", Section 121's sample instruction: "Create three
 * Instagram creative concepts for Client A based on the recommended
 * campaign.").
 *
 * Architecturally closer to the Competitor Agent than to the Marketing
 * Analytics/SEO agents: `allowedToolKeys: []`, no `executeTool` calls at
 * all. This agent's only job is generating creative CONCEPTS (title,
 * copy, visual description) from Client Brain context - it never calls
 * Canva itself. Actually creating the Canva design for an already-drafted
 * concept is a separate step (`generateCreativeDesign`,
 * `src/lib/creative/persist.ts`, calling `canva.create_design` directly),
 * mirroring how `scheduleContentCalendarItem` calls
 * `metricool.schedule_post` directly rather than through an agent - BRD
 * Section 47's flow ("Claude creative concepts → Canva MCP → Design
 * creation/editing") is explicitly two separate steps, not one.
 *
 * Uses the `content` Context Router category (`business`/`audience`/
 * `brand` sections - BRD Section 6's Brand voice/tone/colors/restricted
 * imagery/messaging rules) and the `content` prompt category
 * (`prompts/content/v1.md`) - both already existed, unused by any agent
 * until now.
 *
 * "Brand validation" (BRD Section 47's flow step) is folded into the
 * structured output itself (`brandAligned`/`brandNotes` per concept)
 * rather than a separate procedural gate - Claude already has the full
 * brand context in front of it while generating each concept, so asking
 * it to self-report alignment there is more direct than a second pass
 * over already-generated text. This is advisory, not enforcement: a
 * `brandAligned: false` concept still reaches `IN_REVIEW`/`APPROVED` like
 * any other if a human approver accepts it - agents never gate approvals
 * themselves (BRD Section 19).
 *
 * Returns concepts, never persists anything - `src/lib/workflows/
 * creative-workflow.ts` is what turns them into real `CreativeAsset` rows.
 */

export const CREATIVE_AGENT_KEY = 'creative_concepts'

export async function registerCreativeAgent(): Promise<void> {
  await registerAgent({
    key: CREATIVE_AGENT_KEY,
    name: 'Creative Agent',
    purpose:
      "Generates creative concepts (title, copy, visual description) for a client's social content, grounded in their Client Brain business/audience/brand context.",
    allowedToolKeys: [],
  })
}

export const CreativeConceptSchema = z.object({
  title: z.string(),
  copy: z.string().describe('Draft post copy for this concept - specific, not generic marketing language'),
  visualDescription: z.string().describe('What the design should show: composition, imagery, style'),
  brandAligned: z.boolean().describe('Whether this concept follows the brand voice/tone/restricted-imagery/messaging rules provided'),
  brandNotes: z
    .string()
    .optional()
    .describe('Any brand-rule assumption made (when rules were incomplete), or concern flagged when brandAligned is false'),
})

export const CreativeBriefResultSchema = z.object({
  summary: z.string().describe('A short (1-3 sentence) summary of the creative direction taken across all concepts'),
  concepts: z.array(CreativeConceptSchema),
})

export interface CreativeBriefInput {
  ctx: AuthContext
  clientId: string
  platform: string
  count: number
  /** The recommended campaign/brief this batch of concepts is for (BRD Section 121's "based on the recommended campaign"). */
  campaignBrief: string
}

export interface CreativeBriefResult {
  summary: string
  concepts: z.infer<typeof CreativeConceptSchema>[]
  /** null only if the AI Gateway call itself couldn't be made - unlike the analysis agents, there's no "every data source failed" guard here, since Client Brain context (however sparse) is always available, never an external dependency that can be down. */
  aiRunId: string | null
}

export async function runCreativeConceptGeneration(input: CreativeBriefInput): Promise<CreativeBriefResult> {
  const { ctx, clientId, platform, count, campaignBrief } = input

  const context = await assembleClientContext(ctx, clientId, 'content')

  const userMessage = [
    renderContextAsText(context),
    `\n--- Generate ${count} ${platform} creative concept(s) for the following campaign ---`,
    campaignBrief,
  ].join('\n')

  const result = await runStructuredAiTask({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    agentKey: CREATIVE_AGENT_KEY,
    promptCategory: 'content',
    variables: { client_name: context.client.name },
    userMessage,
    schema: CreativeBriefResultSchema,
  })

  return { ...result.data, aiRunId: result.aiRunId }
}
