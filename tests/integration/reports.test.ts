import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AnalysisResult } from '@/lib/agents/analytics-agent'
import {
  generateClientReportFromInternal,
  generateReport,
  getReport,
  listReports,
  listReportsForOrg,
  type ReportContent,
} from '@/lib/reports/generate'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { cleanupOrg, createSystemRoles, createTestClient, createTestOrg, createTestUser, testDb } from '../helpers/factory'

const SAMPLE_ANALYSIS: AnalysisResult = {
  summary: 'One campaign is underperforming; social is steady.',
  recommendations: [
    {
      priority: 'HIGH',
      area: 'Google Ads',
      finding: 'CPA on Search Campaign X is above target.',
      evidence: ['cpa: 19.40', 'target: 12.00'],
      likelyCause: 'Broad match keywords.',
      recommendation: 'Tighten match types.',
      expectedImpact: 'Lower CPA by ~20%.',
      confidence: 0.78,
      requiresApproval: true,
    },
  ],
  aiRunId: 'fake-ai-run-id',
  dataGaps: ['GA4 report: connection not configured'],
  metrics: [],
}

describe('Reports (BRD Section 41, 68) - built from structured AnalysisResult, never a fresh AI call', () => {
  let orgId: string
  let clientId: string
  let otherClientId: string
  let userId: string
  let scopedEmployeeId: string // employee, assigned to clientId only

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Reports Test Client')
    clientId = client.id
    const otherClient = await createTestClient(orgId, 'Reports Test Other Client')
    otherClientId = otherClient.id
    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })

    const employee = await createTestUser()
    scopedEmployeeId = employee.id
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: scopedEmployeeId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({ data: { clientId, organizationUserId: membership.id } })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [userId, scopedEmployeeId])
  })

  it('CLIENT report omits confidence, evidence, and data gaps (no internal reasoning exposed - BRD Section 41/102)', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const report = await generateReport(
      ctx!,
      clientId,
      SAMPLE_ANALYSIS,
      { from: '2026-01-01', to: '2026-01-31' },
      'CLIENT',
    )

    expect(report.type).toBe('CLIENT')
    const content = report.content as { findings: Array<Record<string, unknown>>; dataGaps?: unknown }
    expect(content.findings[0]?.evidence).toBeUndefined()
    expect(content.findings[0]?.confidence).toBeUndefined()
    expect(content.dataGaps).toBeUndefined()
    expect(content.findings[0]?.finding).toBe(SAMPLE_ANALYSIS.recommendations[0]!.finding)
  })

  it('INTERNAL report includes confidence, evidence, and data gaps (full technical detail - BRD Section 41)', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const report = await generateReport(
      ctx!,
      clientId,
      SAMPLE_ANALYSIS,
      { from: '2026-01-01', to: '2026-01-31' },
      'INTERNAL',
    )

    expect(report.type).toBe('INTERNAL')
    const content = report.content as { findings: Array<Record<string, unknown>>; dataGaps?: string[] }
    expect(content.findings[0]?.evidence).toEqual(SAMPLE_ANALYSIS.recommendations[0]!.evidence)
    expect(content.findings[0]?.confidence).toBe(0.78)
    expect(content.dataGaps).toEqual(SAMPLE_ANALYSIS.dataGaps)
  })

  it('listReports returns both, tenant-scoped and filterable by type', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const all = await listReports(ctx!, clientId)
    expect(all.length).toBeGreaterThanOrEqual(2)

    const clientOnly = await listReports(ctx!, clientId, { type: 'CLIENT' })
    expect(clientOnly.every((r) => r.type === 'CLIENT')).toBe(true)
  })

  it('getReport returns a single report and denies one belonging to a client outside the caller\'s access (Day 14)', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const internal = await generateReport(
      ctx!,
      clientId,
      SAMPLE_ANALYSIS,
      { from: '2026-02-01', to: '2026-02-28' },
      'INTERNAL',
    )

    const fetched = await getReport(ctx!, internal.id)
    expect(fetched.id).toBe(internal.id)

    const otherReport = await generateReport(
      ctx!,
      otherClientId,
      SAMPLE_ANALYSIS,
      { from: '2026-02-01', to: '2026-02-28' },
      'INTERNAL',
    )
    const scopedCtx = await resolveAuthContext(testDb, scopedEmployeeId, orgId) // assigned to clientId only
    await expect(getReport(scopedCtx!, otherReport.id)).rejects.toThrow(ForbiddenError)
  })

  it('listReportsForOrg is scoped like every other cross-client read (Day 14)', async () => {
    const superCtx = await resolveAuthContext(testDb, userId, orgId)
    const all = await listReportsForOrg(superCtx!)
    expect(all.some((r) => r.clientId === clientId)).toBe(true)
    expect(all.some((r) => r.clientId === otherClientId)).toBe(true)

    const scopedCtx = await resolveAuthContext(testDb, scopedEmployeeId, orgId)
    const scoped = await listReportsForOrg(scopedCtx!)
    expect(scoped.every((r) => r.clientId === clientId)).toBe(true)
    expect(scoped.some((r) => r.clientId === otherClientId)).toBe(false)
  })

  it('generateClientReportFromInternal derives a CLIENT report from an INTERNAL one\'s already-persisted content, without a fresh AnalysisResult (BRD Section 68)', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const internal = await generateReport(
      ctx!,
      clientId,
      SAMPLE_ANALYSIS,
      { from: '2026-03-01', to: '2026-03-31' },
      'INTERNAL',
    )

    const derived = await generateClientReportFromInternal(ctx!, internal.id)
    expect(derived.type).toBe('CLIENT')
    expect(derived.clientId).toBe(clientId)
    expect(derived.periodStart).toEqual(internal.periodStart)

    const content = derived.content as { findings: Array<Record<string, unknown>>; dataGaps?: unknown }
    expect(content.findings[0]?.evidence).toBeUndefined()
    expect(content.findings[0]?.confidence).toBeUndefined()
    expect(content.dataGaps).toBeUndefined()
    expect(content.findings[0]?.finding).toBe(SAMPLE_ANALYSIS.recommendations[0]!.finding)

    // Refuses to derive from a report that is already CLIENT-facing.
    await expect(generateClientReportFromInternal(ctx!, derived.id)).rejects.toThrow(/requires an INTERNAL report/)
  })

  describe('period-over-period trends (BRD Section 41/68/69 - "advanced reporting")', () => {
    it('the first report for a metric has no prior value to compare against; a later one correctly computes the % change and persists both as AnalyticsSnapshot rows', async () => {
      const ctx = await resolveAuthContext(testDb, userId, orgId)
      const trendClient = await createTestClient(orgId, 'Trend Test Client')

      const firstAnalysis: AnalysisResult = {
        ...SAMPLE_ANALYSIS,
        metrics: [{ metricName: 'ga4.sessions', value: 1000, unit: 'count', source: 'ga4', retrievedAt: new Date().toISOString(), period: '2026-04-01..2026-04-30' }],
      }
      const first = await generateReport(ctx!, trendClient.id, firstAnalysis, { from: '2026-04-01', to: '2026-04-30' }, 'INTERNAL')
      const firstContent = first.content as unknown as ReportContent
      expect(firstContent.trends).toHaveLength(1)
      expect(firstContent.trends![0]).toMatchObject({ metricName: 'ga4.sessions', currentValue: 1000, previousValue: null, changePercent: null })

      const secondAnalysis: AnalysisResult = {
        ...SAMPLE_ANALYSIS,
        metrics: [{ metricName: 'ga4.sessions', value: 1250, unit: 'count', source: 'ga4', retrievedAt: new Date().toISOString(), period: '2026-05-01..2026-05-31' }],
      }
      const second = await generateReport(ctx!, trendClient.id, secondAnalysis, { from: '2026-05-01', to: '2026-05-31' }, 'INTERNAL')
      const secondContent = second.content as unknown as ReportContent
      expect(secondContent.trends).toHaveLength(1)
      expect(secondContent.trends![0]?.currentValue).toBe(1250)
      expect(secondContent.trends![0]?.previousValue).toBe(1000)
      expect(secondContent.trends![0]?.changePercent).toBeCloseTo(25, 5) // (1250-1000)/1000 * 100

      const snapshots = await db.analyticsSnapshot.findMany({ where: { clientId: trendClient.id, metricName: 'ga4.sessions' }, orderBy: { date: 'asc' } })
      expect(snapshots).toHaveLength(2)
      expect(snapshots.map((s) => s.value.toNumber())).toEqual([1000, 1250])

      await db.analyticsSnapshot.deleteMany({ where: { clientId: trendClient.id } })
      await testDb.client.delete({ where: { id: trendClient.id } })
    })

    it('a report generated from an analysis with no metrics has no trends field at all (not an empty array)', async () => {
      const ctx = await resolveAuthContext(testDb, userId, orgId)
      const report = await generateReport(ctx!, clientId, SAMPLE_ANALYSIS, { from: '2026-06-01', to: '2026-06-30' }, 'INTERNAL')
      const content = report.content as unknown as ReportContent
      expect(content.trends).toBeUndefined()
    })
  })
})
