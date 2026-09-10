import { runSeoAnalysis, type SeoRunInput } from '@/lib/agents/seo-agent'
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
 * "Run SEO analysis" (BRD-PRD Section 85 Phase 2 - the SEO Agent listed as
 * "Later" in Section 25, built now). Mirrors `analyze-client-workflow.ts`
 * step-for-step, just with the SEO Agent (Search Console only) in place of
 * the Marketing Analytics Agent (social/ads/GA4/GSC) - same authorization,
 * persistence, routing, reporting, and audit chain, deliberately not
 * duplicated with new logic. Same non-negotiable: this workflow's job ends
 * at recommendations + a report + any pending approvals it created - never
 * at executing anything (BRD Section 19).
 */

export const SEO_ANALYSIS_WORKFLOW_KEY = 'seo_performance_analysis'

export interface SeoAnalysisWorkflowInput {
  ctx: AuthContext
  clientId: string
  range: { from: string; to: string }
}

export interface SeoAnalysisWorkflowResult {
  workflowRunId: string
  analysis: AnalysisResult
  recommendationIds: string[]
  taskIds: string[]
  approvalIds: string[]
  reportId: string
}

export async function runSeoAnalysisWorkflow(
  input: SeoAnalysisWorkflowInput,
): Promise<SeoAnalysisWorkflowResult> {
  const { ctx, clientId, range } = input

  // Same gate as "Analyze this client" - triggering any AI analysis is
  // staff-only (BRD Section 4.2-4.3); a client_user reviews what it
  // produces (recommendations.review) but doesn't spend on running one.
  assertPermission(ctx, 'analysis.trigger')
  await getAuthorizedClient(ctx, clientId)

  const workflow = await getOrCreateWorkflow(
    ctx.organizationId,
    SEO_ANALYSIS_WORKFLOW_KEY,
    'SEO Performance Analysis',
    { steps: ['analysis', 'persist_recommendations', 'route_recommendations', 'report'] },
  )
  const run = await startWorkflowRun({
    organizationId: ctx.organizationId,
    clientId,
    workflowId: workflow.id,
    triggeredBy: ctx.userId,
  })

  const seoRunInput: SeoRunInput = { ctx, clientId, range }

  try {
    await recordWorkflowStep(run.id, 'analysis', 'RUNNING')
    const analysis = await runSeoAnalysis(seoRunInput)
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
    const report = await generateReport(ctx, clientId, analysis, range, 'INTERNAL', 'SEO Performance Report')
    await recordWorkflowStep(run.id, 'report', 'SUCCEEDED', { output: { reportId: report.id } })

    await completeWorkflowRun(run.id, 'SUCCEEDED')
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId,
      userId: ctx.userId,
      action: `workflow.${SEO_ANALYSIS_WORKFLOW_KEY}`,
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
      action: `workflow.${SEO_ANALYSIS_WORKFLOW_KEY}`,
      result: 'FAILURE',
      error: message,
    })
    throw error
  }
}
