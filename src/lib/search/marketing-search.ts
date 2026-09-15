import { z } from 'zod/v4'
import { assembleClientContext, renderContextAsText } from '@/lib/clients/context-router'
import { listAccessibleClients } from '@/lib/clients/list'
import { listApprovals } from '@/lib/approvals/approvals'
import { listRecommendationsForOrg } from '@/lib/recommendations/persist'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import type { AuthContext } from '@/lib/rbac/types'
import { registerAgent } from '@/lib/agents/registry'

/**
 * The "ask anything about your marketing" search bar (main dashboard) and
 * the guided ad campaign wizard's contextual "not sure? ask" helper - two
 * surfaces, one small read-only agent behind both. Empty tool allowlist,
 * same as the Creative/Competitor/Campaign Brief agents: this never
 * executes anything, only answers questions grounded in data the caller
 * already has real access to (BRD Section 19/56 - a search result is
 * never itself an action, and it never fabricates a client, number, or
 * status that isn't actually in the data assembled below).
 *
 * Every data source this pulls from (`listAccessibleClients`,
 * `listApprovals`, `listRecommendationsForOrg`, `assembleClientContext`)
 * is already tenant/permission-scoped on its own - this module adds no
 * new scoping logic of its own, deliberately, so there's exactly one
 * place cross-client access is ever decided.
 */

/**
 * A free-text question ("how is Acme Bakery doing this week?") names a
 * client the other way round from a typeahead search - the client's name is
 * a substring of the question, not the other way round - so this can't
 * reuse `searchAccessibleClients` (built for the header's prefix typeahead).
 * Picks the longest matching accessible client name to avoid a short name
 * accidentally matching inside an unrelated one.
 */
function findNamedClient<T extends { name: string }>(query: string, clients: T[]): T | undefined {
  const lowerQuery = query.toLowerCase()
  return clients
    .filter((c) => c.name.trim().length > 0 && lowerQuery.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0]
}

export const MARKETING_SEARCH_AGENT_KEY = 'marketing_search'

export async function registerMarketingSearchAgent(): Promise<void> {
  await registerAgent({
    key: MARKETING_SEARCH_AGENT_KEY,
    name: 'Marketing Search Assistant',
    purpose:
      "Answers a staff member's plain-language question about their clients' marketing - approvals, recommendations, campaigns - grounded only in data they already have real access to. Also backs the ad campaign wizard's contextual help.",
    allowedToolKeys: [],
  })
}

const MarketingSearchAnswerSchema = z.object({
  answer: z.string(),
  notCovered: z.boolean().describe("true if the question genuinely could not be answered from the data given - the answer should then say so and suggest where to look instead"),
})

export interface SuggestedLink {
  label: string
  href: string
}

export interface MarketingSearchResult {
  answer: string
  notCovered: boolean
  links: SuggestedLink[]
  aiRunId: string
}

/** The dashboard search bar. Grounds on one matching client (if the question names one) plus a snapshot of pending approvals and high-priority recommendations across every client the caller can access. */
export async function answerMarketingQuestion(ctx: AuthContext, query: string): Promise<MarketingSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('Ask a question first.')
  await registerMarketingSearchAgent()

  const [accessibleClients, pendingApprovals, allRecommendations] = await Promise.all([
    listAccessibleClients(ctx),
    listApprovals(ctx, { status: 'PENDING', limit: 8 }),
    listRecommendationsForOrg(ctx, { status: 'RECOMMENDED', limit: 30 }),
  ])
  const focusClient = findNamedClient(trimmed, accessibleClients)
  const urgentRecs = allRecommendations.filter((r) => r.priority === 'HIGH' || r.priority === 'CRITICAL').slice(0, 8)

  const clientContext = focusClient ? await assembleClientContext(ctx, focusClient.id, 'campaign') : null

  const blocks: string[] = []
  if (clientContext && focusClient) {
    blocks.push(`--- Full context for ${focusClient.name} (the client this question looks like it's about) ---`)
    blocks.push(renderContextAsText(clientContext))
  }
  blocks.push('\n--- Pending approvals across your clients ---')
  blocks.push(
    pendingApprovals.length > 0
      ? pendingApprovals.map((a) => `${a.client.name}: ${a.actionSummary} (${a.riskLevel} risk, requested ${a.createdAt.toISOString().slice(0, 10)})`).join('\n')
      : 'None right now.',
  )
  blocks.push('\n--- High-priority recommendations across your clients ---')
  blocks.push(urgentRecs.length > 0 ? urgentRecs.map((r) => `${r.client.name} (${r.priority}): ${r.finding}`).join('\n') : 'None right now.')
  blocks.push('\n--- Question ---')
  blocks.push(trimmed)

  const result = await runStructuredAiTask({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    agentKey: MARKETING_SEARCH_AGENT_KEY,
    promptCategory: 'marketing-search',
    variables: { client_name: focusClient?.name ?? 'your agency' },
    userMessage: blocks.join('\n'),
    schema: MarketingSearchAnswerSchema,
  })

  const links: SuggestedLink[] = []
  if (focusClient) links.push({ label: focusClient.name, href: `/dashboard/clients/${focusClient.id}` })
  if (pendingApprovals.length > 0) links.push({ label: 'Approvals Gate', href: '/dashboard/approvals' })
  if (urgentRecs.length > 0) links.push({ label: 'Recommendations', href: '/dashboard/recommendations' })

  return { answer: result.data.answer, notCovered: result.data.notCovered, links, aiRunId: result.aiRunId }
}

const WizardHelpAnswerSchema = z.object({
  answer: z.string(),
})

export interface WizardHelpResult {
  answer: string
  aiRunId: string
}

export interface AnswerWizardQuestionInput {
  ctx: AuthContext
  clientId: string
  /** Which step they're on, in plain language, e.g. "Where to run it". */
  step: string
  /** What they've filled in so far, as a short plain-text summary - optional. */
  formSoFar?: string
  question: string
}

/** The ad campaign wizard's "not sure? ask" helper - grounded in the client's own context plus where they are in the wizard, never the wider org snapshot (irrelevant noise for a "what does this field mean" question). */
export async function answerWizardQuestion(input: AnswerWizardQuestionInput): Promise<WizardHelpResult> {
  const question = input.question.trim()
  if (!question) throw new Error('Ask a question first.')
  await registerMarketingSearchAgent()

  const context = await assembleClientContext(input.ctx, input.clientId, 'campaign')

  const userMessage = [
    renderContextAsText(context),
    '\n--- Where they are in the wizard ---',
    `Step: ${input.step}`,
    input.formSoFar ? `What they've entered so far: ${input.formSoFar}` : undefined,
    '\n--- Their question ---',
    question,
  ]
    .filter(Boolean)
    .join('\n')

  const result = await runStructuredAiTask({
    organizationId: input.ctx.organizationId,
    clientId: input.clientId,
    userId: input.ctx.userId,
    agentKey: MARKETING_SEARCH_AGENT_KEY,
    promptCategory: 'wizard-help',
    variables: { client_name: context.client.name },
    userMessage,
    schema: WizardHelpAnswerSchema,
  })

  return { answer: result.data.answer, aiRunId: result.aiRunId }
}
