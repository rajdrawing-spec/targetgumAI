import { runCompetitorAnalysis } from '@/lib/agents/competitor-agent'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { generateReport } from '@/lib/reports/generate'
import { persistRecommendations } from '@/lib/recommendations/persist'
import { routeRecommendation } from '@/lib/recommendations/route'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { completeWorkflowRun, getOrCreateWorkflow, recordWorkflowStep, startWorkflowRun } from './runs'
import type { AnalysisResult } from '@/lib/agents/analytics-agent'

/**
 * "Run competitor analysis" (BRD-PRD Section 85 Phase 2 - the Competitor
 * Agent listed as "Later" in Section 25, built now). Mirrors
 * `analyze-client-workflow.ts`/`seo-analysis-workflow.ts` step-for-step -
 * same authorization, persistence, routing, reporting, and audit chain,
 * deliberately not duplicated with new logic. The only real difference is
 * the range parameter every other workflow takes: competitor positioning
 * isn't time-boxed the way performance data is, so this workflow has none -
 * `generateReport` still needs *a* period for its content shape, so
 * `range` is set to "as of today" (a single-day span) rather than a
 * meaningless multi-week window implying data that doesn't exist.
 */

export const COMPETITOR_ANALYSIS_WORKFLOW_KEY = 'competitor_positioning_analysis'

export interface CompetitorAnalysisWorkflowInput {
  ctx: AuthContext
  clientId: string
}

export interface CompetitorAnalysisWorkflowResult {
  workflowRunId: string
  analysis: AnalysisResult
  recommendationIds: string[]
  taskIds: string[]
  approvalIds: string[]
  reportId: string
}

export async function runCompetitorAnalysisWorkflow(
  input: CompetitorAnalysisWorkflowInput,
): Promise<CompetitorAnalysisWorkflowResult> {
  const { ctx, clientId } = input

  // Same gate as every other "run an analysis" trigger - staff-only (BRD
  // Section 4.2-4.3); a client_user reviews what it produces
  // (recommendations.review) but doesn't spend on running one.
  assertPermission(ctx, 'analysis.trigger')
  await getAuthorizedClient(ctx, clientId)

  const asOf = new Date().toISOString().slice(0, 10)
  const range = { from: asOf, to: asOf }

  const workflow = await getOrCreateWorkflow(
    ctx.organizationId,
    COMPETITOR_ANALYSIS_WORKFLOW_KEY,
    'Competitor Positioning Analysis',
    { steps: ['analysis', 'persist_recommendations', 'route_recommendations', 'report'] },
  )
  const run = await startWorkflowRun({
    organizationId: ctx.organizationId,
    clientId,
    workflowId: workflow.id,
    triggeredBy: ctx.userId,
  })

  try {
    await recordWorkflowStep(run.id, 'analysis', 'RUNNING')
    const analysis = await runCompetitorAnalysis({ ctx, clientId })
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

    await recordWorkflowStep(run.id, 'report', 'RUNNING')
    const report = await generateReport(ctx, clientId, analysis, range, 'INTERNAL', 'Competitor Positioning Report')
    await recordWorkflowStep(run.id, 'report', 'SUCCEEDED', { output: { reportId: report.id } })

    await completeWorkflowRun(run.id, 'SUCCEEDED')
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${COMPETITOR_ANALYSIS_WORKFLOW_KEY}`,
      result: 'SUCCESS',
      outputSummary: {
        recommendationCount: recommendationIds.length,
        taskCount: taskIds.length,
        approvalCount: approvalIds.length,
      },
    })

    return { workflowRunId: run.id, analysis, recommendationIds, taskIds, approvalIds, reportId: report.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow failure.'
    await completeWorkflowRun(run.id, 'FAILED', message)
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${COMPETITOR_ANALYSIS_WORKFLOW_KEY}`,
      result: 'FAILURE',
      error: message,
    })
    throw error
  }
}
