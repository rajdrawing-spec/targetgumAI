import type { Prisma, RecommendationStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Recommendation persistence + lifecycle (BRD-PRD Section 39, 107). The
 * Marketing Analytics Agent (Day 9, src/lib/agents/analytics-agent.ts)
 * produces `AnalysisResult.recommendations` in memory - this is what
 * turns them into durable, tenant-scoped `Recommendation` rows so a human
 * can see, accept, or reject them.
 */

export interface RecommendationInput {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  area: string
  finding: string
  evidence: string[]
  likelyCause?: string
  recommendation: string
  expectedImpact?: string
  confidence: number
  requiresApproval: boolean
}

/** Persists a batch of recommendations from one AI run. Initial status: RECOMMENDED - the AI has already analyzed and recommended; next is a human ACCEPT/REJECT (BRD Section 107 lifecycle). */
export async function persistRecommendations(
  ctx: AuthContext,
  clientId: string,
  aiRunId: string,
  recommendations: RecommendationInput[],
) {
  await getAuthorizedClient(ctx, clientId)
  return Promise.all(
    recommendations.map((rec) =>
      db.recommendation.create({
        data: {
          organizationId: ctx.organizationId,
          clientId,
          aiRunId,
          priority: rec.priority,
          area: rec.area,
          finding: rec.finding,
          evidence: rec.evidence as Prisma.InputJsonValue,
          likelyCause: rec.likelyCause,
          recommendation: rec.recommendation,
          expectedImpact: rec.expectedImpact,
          confidence: rec.confidence,
          requiresApproval: rec.requiresApproval,
          status: 'RECOMMENDED',
        },
      }),
    ),
  )
}

export async function listRecommendations(
  ctx: AuthContext,
  clientId: string,
  filter: { status?: RecommendationStatus } = {},
) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.recommendation.findMany({
    where: { clientId, ...(filter.status && { status: filter.status }) },
    orderBy: { createdAt: 'desc' },
  })
}

async function getOwnedRecommendation(ctx: AuthContext, recommendationId: string) {
  const rec = await db.recommendation.findUnique({ where: { id: recommendationId } })
  if (!rec || rec.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this recommendation.')
  }
  const client = await db.client.findUnique({ where: { id: rec.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this recommendation.')
  assertClientAccess(ctx, client)
  return rec
}

export async function getRecommendation(ctx: AuthContext, recommendationId: string) {
  assertPermission(ctx, 'clients.read')
  return getOwnedRecommendation(ctx, recommendationId)
}

export async function acceptRecommendation(ctx: AuthContext, recommendationId: string) {
  assertPermission(ctx, 'approvals.request')
  const rec = await getOwnedRecommendation(ctx, recommendationId)
  if (rec.status !== 'RECOMMENDED') {
    throw new Error(`Cannot accept a recommendation in status ${rec.status}.`)
  }
  return db.recommendation.update({ where: { id: recommendationId }, data: { status: 'ACCEPTED' } })
}

/**
 * Rejecting a recommendation also records it as ClientFeedback (BRD
 * Section 108: "Store... rejected recommendations, rejection reason...
 * use this to improve prompts and rules") - the loop from Day 8's Client
 * Brain back to itself.
 */
export async function rejectRecommendation(ctx: AuthContext, recommendationId: string, reason: string) {
  assertPermission(ctx, 'approvals.request')
  const rec = await getOwnedRecommendation(ctx, recommendationId)
  if (rec.status !== 'RECOMMENDED') {
    throw new Error(`Cannot reject a recommendation in status ${rec.status}.`)
  }

  const [updated] = await db.$transaction([
    db.recommendation.update({
      where: { id: recommendationId },
      data: { status: 'REJECTED', rejectionReason: reason },
    }),
    db.clientFeedback.create({
      data: {
        clientId: rec.clientId,
        category: 'REJECTED_PATTERN',
        content: `Recommendation rejected: "${rec.recommendation}" (area: ${rec.area}). Reason: ${reason}`,
        source: 'ACCOUNT_MANAGER',
        createdBy: ctx.userId,
      },
    }),
  ])

  return updated
}
