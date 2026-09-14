import { runMarketingAnalysis, type MarketingAnalysisResult } from '@/lib/agents/analytics-agent'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { generateReport } from '@/lib/reports/generate'
import { persistRecommendations } from '@/lib/recommendations/persist'
import { routeRecommendation } from '@/lib/recommendations/route'
import { dispatchProposedActions, type ProposedActionResult } from '@/lib/automation/dispatch-proposed-actions'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { completeWorkflowRun, getOrCreateWorkflow, recordWorkflowStep, startWorkflowRun } from './runs'

/**
 * The MVP workflow (BRD-PRD Section 46): "Analyze Client A's marketing
 * performance and tell me what needs attention." Wires together every
 * prior day into one callable, auditable, tracked pipeline:
 *
 *   Client resolution + Authorization -> Client Brain (Day 8, inside the
 *   agent) -> Metricool/GA4/GSC data (Days 6-7, inside the agent) ->
 *   Claude analysis (Day 4/9) -> Findings/Recommendations -> persisted
 *   (Day 10) -> routed to tasks or approvals (Day 10) -> Report (Day 11) ->
 *   Audit.
 *
 * "No campaign modification should occur merely because Claude
 * recommends it" (BRD Section 19) still holds: this workflow's job ends
 * at recommendations + a report + any pending approvals it created -
 * never at executing anything.
 */

export const ANALYZE_CLIENT_WORKFLOW_KEY = 'analyze_client_performance'

export interface AnalyzeClientWorkflowInput {
  ctx: AuthContext
  clientId: string
  range: { from: string; to: string }
  socialNetwork: string
  adsChannel: string
}

export interface AnalyzeClientWorkflowResult {
  workflowRunId: string
  analysis: MarketingAnalysisResult
  recommendationIds: string[]
  taskIds: string[]
  approvalIds: string[]
  /** Phase 3: outcome per proposed action (executed / pending approval / skipped / failed) - see dispatch-proposed-actions.ts. */
  proposedActionResults: ProposedActionResult[]
  reportId: string
}

export async function runAnalyzeClientWorkflow(
  input: AnalyzeClientWorkflowInput,
): Promise<AnalyzeClientWorkflowResult> {
  const { ctx, clientId, range } = input

  // Client resolution + Authorization (BRD Section 46, steps 1-2).
  // `analysis.trigger` is staff-only (BRD Section 4.2-4.3) - a client
  // can review/approve what an analysis produces, but not spend on running
  // a fresh one themselves (Section 4.4 lists no such capability).
  assertPermission(ctx, 'analysis.trigger')
  await getAuthorizedClient(ctx, clientId)

  const workflow = await getOrCreateWorkflow(
    ctx.organizationId,
    ANALYZE_CLIENT_WORKFLOW_KEY,
    'Analyze Client Performance',
    {
      steps: ['analysis', 'persist_recommendations', 'route_recommendations', 'execute_proposed_actions', 'report'],
    },
  )
  const run = await startWorkflowRun({
    organizationId: ctx.organizationId,
    clientId,
    workflowId: workflow.id,
    triggeredBy: ctx.userId,
  })

  try {
    await recordWorkflowStep(run.id, 'analysis', 'RUNNING')
    const analysis = await runMarketingAnalysis({
      ctx,
      clientId,
      range,
      socialNetwork: input.socialNetwork,
      adsChannel: input.adsChannel,
    })
    await recordWorkflowStep(run.id, 'analysis', 'SUCCEEDED', {
      output: { recommendationCount: analysis.recommendations.length, dataGapCount: analysis.dataGaps.length },
    })

    const recommendationIds: string[] = []
    const taskIds: string[] = []
    const approvalIds: string[] = []

    if (analysis.aiRunId && analysis.recommendations.length > 0) {
      await recordWorkflowStep(run.id, 'persist_recommendations', 'RUNNING')
      const persisted = await persistRecommendations(ctx, clientId, analysis.aiRunId, analysis.recommendations)
      recommendationIds.push(...persisted.map((r) => r.id))
      await recordWorkflowStep(run.id, 'persist_recommendations', 'SUCCEEDED', {
        output: { count: persisted.length },
      })

      await recordWorkflowStep(run.id, 'route_recommendations', 'RUNNING')
      for (const rec of persisted) {
        const routed = await routeRecommendation(ctx, rec.id)
        if (routed.kind === 'task') taskIds.push(routed.taskId)
        else approvalIds.push(routed.approvalId)
      }
      await recordWorkflowStep(run.id, 'route_recommendations', 'SUCCEEDED', {
        output: { taskCount: taskIds.length, approvalCount: approvalIds.length },
      })
    } else {
      await recordWorkflowStep(run.id, 'persist_recommendations', 'SKIPPED')
      await recordWorkflowStep(run.id, 'route_recommendations', 'SKIPPED')
    }

    let proposedActionResults: ProposedActionResult[] = []
    if (analysis.aiRunId && analysis.proposedActions.length > 0) {
      await recordWorkflowStep(run.id, 'execute_proposed_actions', 'RUNNING')
      proposedActionResults = await dispatchProposedActions({
        ctx,
        clientId,
        workflowRunId: run.id,
        aiRunId: analysis.aiRunId,
        proposedActions: analysis.proposedActions,
        campaignsByProvider: analysis.campaignsByProvider,
      })
      approvalIds.push(
        ...proposedActionResults
          .map((r) => (r.result.outcome === 'PENDING_APPROVAL' ? r.result.approvalId : undefined))
          .filter((id): id is string => id !== undefined),
      )
      await recordWorkflowStep(run.id, 'execute_proposed_actions', 'SUCCEEDED', {
        output: {
          executed: proposedActionResults.filter((r) => r.result.outcome === 'EXECUTED').length,
          pendingApproval: proposedActionResults.filter((r) => r.result.outcome === 'PENDING_APPROVAL').length,
          skipped: proposedActionResults.filter((r) => r.result.outcome === 'SKIPPED').length,
          failed: proposedActionResults.filter((r) => r.result.outcome === 'FAILED').length,
        },
      })
    } else {
      await recordWorkflowStep(run.id, 'execute_proposed_actions', 'SKIPPED')
    }

    await recordWorkflowStep(run.id, 'report', 'RUNNING')
    const report = await generateReport(ctx, clientId, analysis, range, 'INTERNAL')
    await recordWorkflowStep(run.id, 'report', 'SUCCEEDED', { output: { reportId: report.id } })

    await completeWorkflowRun(run.id, 'SUCCEEDED')
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${ANALYZE_CLIENT_WORKFLOW_KEY}`,
      result: 'SUCCESS',
      outputSummary: {
        recommendationCount: recommendationIds.length,
        taskCount: taskIds.length,
        approvalCount: approvalIds.length,
        proposedActionCount: proposedActionResults.length,
      },
    })

    return { workflowRunId: run.id, analysis, recommendationIds, taskIds, approvalIds, proposedActionResults, reportId: report.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow failure.'
    await completeWorkflowRun(run.id, 'FAILED', message)
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${ANALYZE_CLIENT_WORKFLOW_KEY}`,
      result: 'FAILURE',
      error: message,
    })
    throw error
  }
}
