import { runCreativeConceptGeneration } from '@/lib/agents/creative-agent'
import { persistCreativeAssetsFromBrief } from '@/lib/creative/persist'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { completeWorkflowRun, getOrCreateWorkflow, recordWorkflowStep, startWorkflowRun } from './runs'

/**
 * "Generate creative concepts" (BRD Section 47's MVP Creative Workflow,
 * Section 121's sample instruction). Unlike every other Phase 1/2
 * workflow in this codebase (`analyze-client-workflow.ts`/`seo-analysis-
 * workflow.ts`/`competitor-analysis-workflow.ts`), this one does NOT
 * persist `Recommendation` rows or route them to a `Task`/`Approval`, and
 * produces no `Report` - the Creative Agent generates creative CONCEPTS
 * (a different structured shape entirely, `CreativeBriefResultSchema`),
 * which become `CreativeAsset` rows directly, carrying their own
 * DRAFT->IN_REVIEW->APPROVED/REJECTED lifecycle
 * (`src/lib/creative/persist.ts`) instead. Two steps only: `generation`,
 * `persist_creative_assets`.
 */

export const CREATIVE_WORKFLOW_KEY = 'creative_concept_generation'

export interface CreativeWorkflowInput {
  ctx: AuthContext
  clientId: string
  platform: string
  count: number
  campaignBrief: string
}

export interface CreativeWorkflowResult {
  workflowRunId: string
  summary: string
  creativeAssetIds: string[]
  aiRunId: string | null
}

export async function runCreativeWorkflow(input: CreativeWorkflowInput): Promise<CreativeWorkflowResult> {
  const { ctx, clientId, platform, count, campaignBrief } = input

  // Same gate as every other "run an AI generation" trigger - staff-only (BRD Section 4.2-4.3).
  assertPermission(ctx, 'analysis.trigger')
  await getAuthorizedClient(ctx, clientId)

  const workflow = await getOrCreateWorkflow(
    ctx.organizationId,
    CREATIVE_WORKFLOW_KEY,
    'Creative Concept Generation',
    { steps: ['generation', 'persist_creative_assets'] },
  )
  const run = await startWorkflowRun({
    organizationId: ctx.organizationId,
    clientId,
    workflowId: workflow.id,
    triggeredBy: ctx.userId,
  })

  try {
    await recordWorkflowStep(run.id, 'generation', 'RUNNING')
    const brief = await runCreativeConceptGeneration({ ctx, clientId, platform, count, campaignBrief })
    await recordWorkflowStep(run.id, 'generation', 'SUCCEEDED', { output: { conceptCount: brief.concepts.length } })

    await recordWorkflowStep(run.id, 'persist_creative_assets', 'RUNNING')
    const assets = await persistCreativeAssetsFromBrief(ctx, clientId, ctx.userId, platform, brief.concepts)
    await recordWorkflowStep(run.id, 'persist_creative_assets', 'SUCCEEDED', { output: { count: assets.length } })

    await completeWorkflowRun(run.id, 'SUCCEEDED')
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${CREATIVE_WORKFLOW_KEY}`,
      result: 'SUCCESS',
      outputSummary: { creativeAssetCount: assets.length },
    })

    return { workflowRunId: run.id, summary: brief.summary, creativeAssetIds: assets.map((a) => a.id), aiRunId: brief.aiRunId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow failure.'
    await completeWorkflowRun(run.id, 'FAILED', message)
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${CREATIVE_WORKFLOW_KEY}`,
      result: 'FAILURE',
      error: message,
    })
    throw error
  }
}
