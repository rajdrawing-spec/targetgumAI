import type { IntegrationProvider } from '@prisma/client'
import { db } from '@/lib/db/client'
import { createApproval } from '@/lib/approvals/approvals'
import { executeTool } from '@/lib/tools/execute'
import { ApprovalRequiredError, RiskLevelBlockedError } from '@/lib/tools/errors'
import type { AuthContext } from '@/lib/rbac/types'
import type { AdCampaignRecord } from '@/lib/integrations/ads-schemas'
import type { ProposedAction } from '@/lib/agents/schemas'

/**
 * Phase 3 of the automation roadmap: turns the Marketing Analytics Agent's
 * `proposedActions` (schemas.ts's `ProposedActionSchema`) into either a
 * real tool execution, a pending Approval, or a documented no-op - never
 * decided by Claude itself (BRD Section 19). Called by
 * `analyze-client-workflow.ts`'s new `execute_proposed_actions` step, after
 * recommendations are persisted and routed.
 *
 * Gating, in order:
 *
 * 1. `Client.automationLevel === 'MANUAL'` or `ClientPolicy.autoChangeAds`
 *    is off (or there's no policy row at all - the field defaults to
 *    false) -> every action is left SKIPPED, untouched. This is the
 *    default for every client until an agency explicitly opts in, exactly
 *    like `ClientPolicy.weeklyAutomationEnabled` already works
 *    (docs/DECISIONS.md) - closes the gap flagged in the original audit
 *    where `autoChangeAds` was stored and shown to Claude as prompt
 *    context but never actually enforced.
 * 2. The proposed campaign id must appear in `campaignsByProvider` - the
 *    exact data this run gathered and gave to Claude. An id that isn't
 *    there is refused outright (SKIPPED), never executed "close enough" -
 *    defense against a hallucinated or stale id, independent of whatever
 *    the AI Gateway's structured-output schema already constrains.
 * 3. For `UPDATE_BUDGET`: `ClientPolicy.maxBudgetChangePercent` (vs. that
 *    campaign's own current budget) and `ClientPolicy.maxDailyAdBudget`
 *    (vs. the client's total known daily ad budget across every connected
 *    platform, with this change applied) are real checks now, not just
 *    prompt context - a violation forces the action into the approval-only
 *    path below regardless of automation level (BRD Section 61: "Client
 *    policy can tighten MEDIUM/HIGH defaults" - it can only ever make
 *    execution more conservative, never less).
 * 4. Automation level decides the path for whatever's left:
 *    - `ASSISTED` ("AI drafts and prepares actions"), or any policy
 *      violation from step 3: always a pending Approval, created directly
 *      here (bypassing the tool's own risk gate) so even a MEDIUM-risk
 *      pause never auto-runs - "drafts and prepares" means nothing
 *      executes until a human clicks Approve.
 *    - `APPROVAL_BASED` / `HIGH_AUTOMATION`: dispatched through the normal
 *      `executeTool` risk gate exactly as any other caller - MEDIUM
 *      (`pause_campaign`, spend-reducing) executes immediately, HIGH
 *      (`update_budget`) still creates a pending Approval. Nothing here
 *      grants either automation level a bypass of that gate - see
 *      docs/DECISIONS.md for why these two levels aren't further
 *      distinguished yet (the Tool Registry has no mechanism today for a
 *      client policy to auto-approve a HIGH-risk call, and this file isn't
 *      the place to invent one).
 *
 * CRITICAL-risk tools are never reachable here at all (no proposed action
 * type maps to one) - BRD Section 61's "critical actions should never
 * bypass explicit policy" holds trivially.
 *
 * Deliberately never passes an `agentKey` to `executeTool`/`createApproval`
 * here. The Marketing Analytics Agent's own Tool Registry allowlist is
 * read-only by construction (every tool in it is LOW risk - see its doc
 * comment in analytics-agent.ts) and stays that way; this file, not the
 * agent, is what's allowed to act on a proposal, using the real ctx's own
 * `ads.manage` permission - the same way a human clicking "Pause" in the
 * UI does (`src/lib/ads/service.ts`'s `toggleCampaignStatus`), not as if
 * the agent itself were calling the tool. Traceability back to the run
 * that proposed the action still holds through `workflowRunId` (every
 * execution/approval below carries it) and `aiRunId` (carried in the
 * approval's own `proposedChanges` where relevant) - just not through
 * `agentId`, which would require weakening that allowlist.
 */

export type ProposedActionOutcome =
  | { outcome: 'EXECUTED' }
  | { outcome: 'PENDING_APPROVAL'; approvalId: string }
  | { outcome: 'SKIPPED'; reason: string }
  | { outcome: 'FAILED'; reason: string }

export interface ProposedActionResult {
  provider: IntegrationProvider
  action: ProposedAction['action']
  providerCampaignId: string
  campaignName: string
  result: ProposedActionOutcome
}

export interface DispatchProposedActionsInput {
  ctx: AuthContext
  clientId: string
  workflowRunId: string
  aiRunId: string
  proposedActions: ProposedAction[]
  campaignsByProvider: Partial<Record<IntegrationProvider, AdCampaignRecord[]>>
}

/** Only providers with a real, write-capable `AdsProvider` adapter (BRD Section 109) can have a proposed action executed against them. */
const PROPOSED_ACTION_TOOLS: Partial<Record<IntegrationProvider, { PAUSE_CAMPAIGN: string; UPDATE_BUDGET: string }>> = {
  META_ADS: { PAUSE_CAMPAIGN: 'meta_ads.pause_campaign', UPDATE_BUDGET: 'meta_ads.update_budget' },
  GOOGLE_ADS: { PAUSE_CAMPAIGN: 'google_ads.pause_campaign', UPDATE_BUDGET: 'google_ads.update_budget' },
  AMAZON_ADS: { PAUSE_CAMPAIGN: 'amazon_ads.pause_campaign', UPDATE_BUDGET: 'amazon_ads.update_budget' },
}

function totalKnownDailyBudget(
  campaignsByProvider: DispatchProposedActionsInput['campaignsByProvider'],
  overrideProviderCampaignId: string,
  overrideBudget: number,
): number {
  let total = 0
  for (const campaigns of Object.values(campaignsByProvider)) {
    for (const campaign of campaigns ?? []) {
      if (campaign.providerCampaignId === overrideProviderCampaignId) {
        total += overrideBudget
      } else if (typeof campaign.budget === 'number') {
        total += campaign.budget
      }
    }
  }
  return total
}

export async function dispatchProposedActions(input: DispatchProposedActionsInput): Promise<ProposedActionResult[]> {
  const { ctx, clientId, workflowRunId, aiRunId, proposedActions, campaignsByProvider } = input

  if (proposedActions.length === 0) return []

  const [client, policy] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    db.clientPolicy.findUnique({ where: { clientId } }),
  ])

  const results: ProposedActionResult[] = []

  const automationDisabled = !client || client.automationLevel === 'MANUAL' || !policy?.autoChangeAds
  const automationDisabledReason = !client
    ? 'Client not found.'
    : client.automationLevel === 'MANUAL'
      ? 'Client automation level is MANUAL - AI recommends, humans execute. Left as a proposal only.'
      : 'ClientPolicy.autoChangeAds is off - this client has not opted in to automated ad changes. Left as a proposal only.'

  for (const proposed of proposedActions) {
    const base = {
      provider: proposed.provider,
      action: proposed.action,
      providerCampaignId: proposed.providerCampaignId,
      campaignName: proposed.campaignName,
    }

    if (automationDisabled) {
      results.push({ ...base, result: { outcome: 'SKIPPED', reason: automationDisabledReason } })
      continue
    }

    const tools = PROPOSED_ACTION_TOOLS[proposed.provider]
    if (!tools) {
      results.push({
        ...base,
        result: { outcome: 'SKIPPED', reason: `No executable tool registered for provider ${proposed.provider}.` },
      })
      continue
    }

    const campaign = campaignsByProvider[proposed.provider]?.find((c) => c.providerCampaignId === proposed.providerCampaignId)
    if (!campaign) {
      results.push({
        ...base,
        result: {
          outcome: 'SKIPPED',
          reason: 'Campaign id was not found in the data gathered for this run - refusing to act on an unverified id.',
        },
      })
      continue
    }

    if (proposed.action === 'UPDATE_BUDGET' && (proposed.newBudget == null || !(proposed.newBudget > 0))) {
      results.push({ ...base, result: { outcome: 'SKIPPED', reason: 'Missing or invalid newBudget for an UPDATE_BUDGET action.' } })
      continue
    }

    const toolKey = proposed.action === 'PAUSE_CAMPAIGN' ? tools.PAUSE_CAMPAIGN : tools.UPDATE_BUDGET
    const toolInput =
      proposed.action === 'PAUSE_CAMPAIGN'
        ? { providerCampaignId: proposed.providerCampaignId }
        : { providerCampaignId: proposed.providerCampaignId, budget: proposed.newBudget }

    // Client policy (BRD Section 62) - a real, enforced check for the
    // first time, not just prompt context. A violation never blocks the
    // action outright; it forces the same "prepare, don't execute" path
    // ASSISTED already uses, so a human always signs off on anything that
    // exceeds the client's own stated limits.
    let policyViolation: string | undefined
    if (proposed.action === 'UPDATE_BUDGET' && proposed.newBudget != null) {
      if (policy?.maxBudgetChangePercent != null && typeof campaign.budget === 'number' && campaign.budget > 0) {
        const changePercent = (Math.abs(proposed.newBudget - campaign.budget) / campaign.budget) * 100
        if (changePercent > policy.maxBudgetChangePercent) {
          policyViolation = `Proposed budget change of ${changePercent.toFixed(1)}% exceeds this client's max of ${policy.maxBudgetChangePercent}%.`
        }
      }
      if (!policyViolation && policy?.maxDailyAdBudget != null) {
        const projectedTotal = totalKnownDailyBudget(campaignsByProvider, proposed.providerCampaignId, proposed.newBudget)
        const maxDailyAdBudget = policy.maxDailyAdBudget.toNumber()
        if (projectedTotal > maxDailyAdBudget) {
          policyViolation = `Projected total daily ad budget of ${projectedTotal} would exceed this client's max of ${maxDailyAdBudget}.`
        }
      }
    }

    const requiresManualApprovalPath = policyViolation !== undefined || client!.automationLevel === 'ASSISTED'

    if (requiresManualApprovalPath) {
      const toolRow = await db.tool.findFirst({ where: { key: toolKey } })
      const approval = await createApproval({
        organizationId: ctx.organizationId,
        clientId,
        requestedBy: ctx.userId,
        workflowRunId,
        actionType: `tool.execute.${toolKey}`,
        riskLevel: toolRow?.riskLevel ?? 'HIGH',
        actionSummary: `${proposed.action === 'PAUSE_CAMPAIGN' ? 'Pause' : 'Change budget for'} "${proposed.campaignName}" (${proposed.provider}) - proposed by the Marketing Analytics Agent`,
        proposedChanges: {
          // No agentKey: this must be executable later via `executeApprovedTool`
          // by whoever clicks Approve, without needing this read-only agent's
          // (nonexistent) write-tool allowlist entry - see the file doc comment.
          toolKey,
          input: toolInput,
          clientId,
          workflowRunId,
          aiRunId,
        },
        estimatedImpact: policyViolation ? { policyViolation } : undefined,
      })
      results.push({ ...base, result: { outcome: 'PENDING_APPROVAL', approvalId: approval.id } })
      continue
    }

    try {
      await executeTool({
        ctx,
        toolKey,
        clientId,
        input: toolInput,
        workflowRunId,
        aiRunId,
      })
      results.push({ ...base, result: { outcome: 'EXECUTED' } })
    } catch (error) {
      if (error instanceof ApprovalRequiredError) {
        results.push({ ...base, result: { outcome: 'PENDING_APPROVAL', approvalId: error.approvalId } })
      } else if (error instanceof RiskLevelBlockedError) {
        results.push({ ...base, result: { outcome: 'SKIPPED', reason: error.message } })
      } else {
        // A real provider failure (e.g. the connection went stale between
        // data gathering and now) shouldn't fail the whole workflow run -
        // same per-item tolerance as `tryGatherData` above. It's still
        // fully audited: `executeTool` records the FAILURE itself.
        results.push({ ...base, result: { outcome: 'FAILED', reason: error instanceof Error ? error.message : 'Unknown error.' } })
      }
    }
  }

  return results
}
