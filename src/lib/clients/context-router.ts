import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { getClientBrainSections } from './brain'
import type { BrainSectionKey } from './brain-schemas'

/**
 * The Context Router (BRD-PRD Section 7):
 *
 *   User Request -> Intent Detection -> Client Identification -> Permission
 *   Check -> Context Router -> Relevant Client Brain -> Real-Time Data -> Claude
 *
 * `assembleClientContext` is what an agent (Day 9+) calls to get exactly the
 * Client Brain slice its task needs - never the whole brain. Do not load a
 * full ClientBrain row into a prompt directly; go through this instead.
 */

export type ContextCategory = 'analytics' | 'content' | 'reporting'

const SECTIONS_BY_CATEGORY: Record<ContextCategory, BrainSectionKey[]> = {
  analytics: ['business', 'marketing'],
  content: ['business', 'audience', 'brand'],
  reporting: ['business', 'marketing'],
}

export interface AssembledClientContext {
  client: { id: string; name: string; automationLevel: string }
  brain: Partial<Record<BrainSectionKey, unknown>>
  policy: {
    maxDailyAdBudget: number | null
    maxBudgetChangePercent: number | null
    autoPublishSocial: boolean
    autoChangeAds: boolean
    requireApprovalForCampaignLaunch: boolean
  } | null
  /** Only assembled for the "analytics" category - not relevant to content/reporting prompts. */
  competitors?: Array<{ name: string; url: string | null; positioning: string | null }>
  recentFeedback: Array<{ category: string; content: string; source: string }>
}

export async function assembleClientContext(
  ctx: AuthContext,
  clientId: string,
  category: ContextCategory,
): Promise<AssembledClientContext> {
  assertPermission(ctx, 'clients.read')
  const client = await getAuthorizedClient(ctx, clientId)

  const [brain, policy, recentFeedback, competitors] = await Promise.all([
    getClientBrainSections(ctx, clientId, SECTIONS_BY_CATEGORY[category]),
    db.clientPolicy.findUnique({ where: { clientId } }),
    db.clientFeedback.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    category === 'analytics'
      ? db.clientCompetitor.findMany({ where: { clientId }, take: 10 })
      : Promise.resolve(null),
  ])

  return {
    client: { id: client.id, name: client.name, automationLevel: client.automationLevel },
    brain,
    policy: policy
      ? {
          maxDailyAdBudget: policy.maxDailyAdBudget ? policy.maxDailyAdBudget.toNumber() : null,
          maxBudgetChangePercent: policy.maxBudgetChangePercent,
          autoPublishSocial: policy.autoPublishSocial,
          autoChangeAds: policy.autoChangeAds,
          requireApprovalForCampaignLaunch: policy.requireApprovalForCampaignLaunch,
        }
      : null,
    competitors: competitors?.map((c) => ({ name: c.name, url: c.url, positioning: c.positioning })),
    recentFeedback: recentFeedback.map((f) => ({
      category: f.category,
      content: f.content,
      source: f.source,
    })),
  }
}

/**
 * Renders the assembled context as a plain-text block, suitable for the AI
 * Gateway's `userMessage` (src/lib/ai/gateway.ts) - the "Real-Time Data ->
 * Claude" step. Deliberately plain text, not a prompt template variable:
 * this is per-request assembled data, not stable/cacheable instruction
 * text (that's what prompts/<category>/vN.md is for).
 */
export function renderContextAsText(context: AssembledClientContext): string {
  const lines: string[] = [`Client: ${context.client.name} (automation level: ${context.client.automationLevel})`]

  for (const [section, data] of Object.entries(context.brain)) {
    if (data == null) continue
    lines.push(`\n${section.charAt(0).toUpperCase()}${section.slice(1)}:`, JSON.stringify(data, null, 2))
  }

  if (context.policy) {
    lines.push('\nPolicy:', JSON.stringify(context.policy, null, 2))
  }
  if (context.competitors?.length) {
    lines.push('\nCompetitors:', JSON.stringify(context.competitors, null, 2))
  }
  if (context.recentFeedback.length) {
    lines.push('\nRecent feedback:', JSON.stringify(context.recentFeedback, null, 2))
  }

  return lines.join('\n')
}
