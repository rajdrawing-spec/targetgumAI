import type { Prisma, ReportType } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import type { AnalysisResult } from '@/lib/agents/analytics-agent'

/**
 * Reporting (BRD-PRD Section 41, 68). Reports are built directly from
 * already-validated structured data (an agent's `AnalysisResult`) - never
 * a fresh AI call re-describing numbers, which is exactly the "Claude
 * guesses metrics" anti-pattern Section 68 warns against. INTERNAL and
 * CLIENT reports render the same underlying data differently: CLIENT
 * omits confidence scores, evidence, and data gaps - "avoid exposing
 * unnecessary internal AI reasoning" (Section 41) / "do not expose hidden
 * chain-of-thought" (Section 102).
 */

export interface ReportFinding {
  area: string
  finding: string
  priority: string
  evidence?: string[]
  confidence?: number
}

export interface ReportRecommendation {
  area: string
  recommendation: string
  priority: string
  expectedImpact?: string
}

export interface ReportContent {
  periodStart: string
  periodEnd: string
  summary: string
  findings: ReportFinding[]
  recommendations: ReportRecommendation[]
  /** Internal reports only - which data sources were unavailable for this run. */
  dataGaps?: string[]
}

function buildContent(
  analysis: AnalysisResult,
  range: { from: string; to: string },
  type: ReportType,
): ReportContent {
  const base = {
    periodStart: range.from,
    periodEnd: range.to,
    summary: analysis.summary,
    recommendations: analysis.recommendations.map((r) => ({
      area: r.area,
      recommendation: r.recommendation,
      priority: r.priority,
      expectedImpact: r.expectedImpact,
    })),
  }

  if (type === 'CLIENT') {
    return {
      ...base,
      findings: analysis.recommendations.map((r) => ({ area: r.area, finding: r.finding, priority: r.priority })),
    }
  }

  return {
    ...base,
    findings: analysis.recommendations.map((r) => ({
      area: r.area,
      finding: r.finding,
      priority: r.priority,
      evidence: r.evidence,
      confidence: r.confidence,
    })),
    dataGaps: analysis.dataGaps,
  }
}

/** BRD Section 4.3 lists "Generate reports" as a Marketing Employee capability - gated the same as other client-data actions (`clients.read`), not a separate permission. */
export async function generateReport(
  ctx: AuthContext,
  clientId: string,
  analysis: AnalysisResult,
  range: { from: string; to: string },
  type: ReportType,
) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)

  const content = buildContent(analysis, range, type)

  return db.report.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      type,
      title: `Marketing Performance Report (${type === 'CLIENT' ? 'Client' : 'Internal'}) — ${range.from} to ${range.to}`,
      periodStart: new Date(range.from),
      periodEnd: new Date(range.to),
      content: content as unknown as Prisma.InputJsonValue,
      generatedBy: ctx.userId,
    },
  })
}

export async function listReports(ctx: AuthContext, clientId: string, filter: { type?: ReportType } = {}) {
  assertPermission(ctx, 'reports.read')
  await getAuthorizedClient(ctx, clientId)
  return db.report.findMany({
    where: { clientId, ...(filter.type && { type: filter.type }) },
    orderBy: { createdAt: 'desc' },
  })
}
