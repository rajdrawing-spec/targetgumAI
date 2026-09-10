import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AnalysisResult } from '@/lib/agents/analytics-agent'
import { generateReport, listReports } from '@/lib/reports/generate'
import { resolveAuthContext } from '@/lib/rbac/context'
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
}

describe('Reports (BRD Section 41, 68) - built from structured AnalysisResult, never a fresh AI call', () => {
  let orgId: string
  let clientId: string
  let userId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Reports Test Client')
    clientId = client.id
    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [userId])
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
})
