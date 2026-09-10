import { createApproval } from '@/lib/approvals/approvals'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { createTaskFromRecommendation } from './tasks'

/**
 * The daily-workflow routing decision from BRD-PRD Section 24:
 *
 *   ...If important issue -> create recommendation -> If safe -> create
 *   task -> If high risk -> request approval
 *
 * A recommendation whose priority is HIGH/CRITICAL or that the AI flagged
 * `requiresApproval` gets an Approval request instead of a task - a human
 * approver, not just a task assignee, has to sign off before anything
 * downstream acts on it. Everything else gets a task for a human to
 * review/action normally.
 */

export type RouteRecommendationResult =
  | { kind: 'approval'; approvalId: string }
  | { kind: 'task'; taskId: string }

export async function routeRecommendation(
  ctx: AuthContext,
  recommendationId: string,
): Promise<RouteRecommendationResult> {
  assertPermission(ctx, 'clients.read')
  const rec = await db.recommendation.findUniqueOrThrow({ where: { id: recommendationId } })
  await getAuthorizedClient(ctx, rec.clientId)

  const isHighRisk = rec.requiresApproval || rec.priority === 'HIGH' || rec.priority === 'CRITICAL'

  if (isHighRisk) {
    const approval = await createApproval({
      organizationId: ctx.organizationId,
      clientId: rec.clientId,
      requestedBy: ctx.userId,
      actionType: `recommendation:${rec.area}`,
      riskLevel: rec.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      actionSummary: rec.finding,
      proposedChanges: { recommendationId: rec.id, recommendation: rec.recommendation, evidence: rec.evidence },
      estimatedImpact: rec.expectedImpact ? { summary: rec.expectedImpact } : undefined,
    })
    await db.recommendation.update({ where: { id: rec.id }, data: { approvalId: approval.id } })
    return { kind: 'approval', approvalId: approval.id }
  }

  const task = await createTaskFromRecommendation(ctx, recommendationId)
  return { kind: 'task', taskId: task.id }
}
