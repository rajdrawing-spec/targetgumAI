import type { Prisma, ReportType } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient, scopedClientWhere } from '@/lib/db/tenant'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import { ForbiddenError } from '@/lib/rbac/errors'
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
  /** Defaults to "Marketing Performance Report" - the SEO workflow (src/lib/workflows/seo-analysis-workflow.ts) passes "SEO Performance Report" so it reads distinctly in the Reports list. */
  reportName = 'Marketing Performance Report',
) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)

  const content = buildContent(analysis, range, type)

  return db.report.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      type,
      title: `${reportName} (${type === 'CLIENT' ? 'Client' : 'Internal'}) — ${range.from} to ${range.to}`,
      periodStart: new Date(range.from),
      periodEnd: new Date(range.to),
      content: content as unknown as Prisma.InputJsonValue,
      generatedBy: ctx.userId,
    },
  })
}

/**
 * A client_user's `filter.type` is never trusted to open this up - INTERNAL
 * reports carry evidence/confidence/dataGaps that BRD Section 41/102 says
 * must never reach a client, so their effective filter is always forced to
 * `CLIENT`, overriding whatever (if anything) was requested.
 */
function effectiveReportTypeFilter(ctx: AuthContext, requested?: ReportType): ReportType | undefined {
  if (ctx.isClientUser) return 'CLIENT'
  return requested
}

export async function listReports(ctx: AuthContext, clientId: string, filter: { type?: ReportType } = {}) {
  assertPermission(ctx, 'reports.read')
  await getAuthorizedClient(ctx, clientId)
  const type = effectiveReportTypeFilter(ctx, filter.type)
  return db.report.findMany({
    where: { clientId, ...(type && { type }) },
    orderBy: { createdAt: 'desc' },
  })
}

/** Org-wide report listing, scoped to the caller's authorized clients (Day 14 dashboard). */
export async function listReportsForOrg(ctx: AuthContext, filter: { type?: ReportType; limit?: number } = {}) {
  assertPermission(ctx, 'reports.read')
  const type = effectiveReportTypeFilter(ctx, filter.type)
  return db.report.findMany({
    where: { ...scopedClientWhere(ctx), ...(type && { type }) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
  })
}

/**
 * Never returns an INTERNAL report to a client_user, even by direct id -
 * BRD Section 41/102's "no internal AI reasoning to the client" has to hold
 * for a guessed/shared URL too, not just the list views that normally
 * filter it out (`effectiveReportTypeFilter` above).
 */
async function getOwnedReport(ctx: AuthContext, reportId: string) {
  const report = await db.report.findUnique({ where: { id: reportId } })
  if (!report || report.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this report.')
  }
  if (ctx.isClientUser && report.type !== 'CLIENT') {
    throw new ForbiddenError('Not authorized for this report.')
  }
  const client = await db.client.findUnique({ where: { id: report.clientId } })
  if (!client) throw new ForbiddenError('Not authorized for this report.')
  assertClientAccess(ctx, client)
  return report
}

/** Single report read, for the Day 14 report detail view. */
export async function getReport(ctx: AuthContext, reportId: string) {
  assertPermission(ctx, 'reports.read')
  return getOwnedReport(ctx, reportId)
}

/**
 * Derives a CLIENT-facing report from an already-generated INTERNAL one,
 * by re-applying the same evidence/confidence/dataGaps redaction
 * `buildContent` does for a fresh `AnalysisResult` - but against data
 * that's already persisted, so this is still "never a fresh AI call"
 * (BRD Section 68): no `AnalysisResult` is re-derived or re-analyzed,
 * only the stored `ReportContent` is redacted.
 */
export async function generateClientReportFromInternal(ctx: AuthContext, internalReportId: string) {
  assertPermission(ctx, 'clients.read')
  const source = await getOwnedReport(ctx, internalReportId)
  if (source.type !== 'INTERNAL') {
    throw new Error('generateClientReportFromInternal requires an INTERNAL report as its source.')
  }

  const sourceContent = source.content as unknown as ReportContent
  const clientContent: ReportContent = {
    periodStart: sourceContent.periodStart,
    periodEnd: sourceContent.periodEnd,
    summary: sourceContent.summary,
    recommendations: sourceContent.recommendations,
    findings: sourceContent.findings.map((f) => ({ area: f.area, finding: f.finding, priority: f.priority })),
  }

  return db.report.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: source.clientId,
      type: 'CLIENT',
      title: source.title.replace('(Internal)', '(Client)'),
      periodStart: source.periodStart,
      periodEnd: source.periodEnd,
      content: clientContent as unknown as Prisma.InputJsonValue,
      generatedBy: ctx.userId,
    },
  })
}
