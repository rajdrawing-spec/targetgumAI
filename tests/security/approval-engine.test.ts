import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { approveApproval, cancelApproval, listApprovals, rejectApproval } from '@/lib/approvals/approvals'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { ApprovalRequiredError } from '@/lib/tools/errors'
import { executeApprovedTool, executeTool } from '@/lib/tools/execute'
import { registerTool } from '@/lib/tools/registry'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * The Approval Engine (Day 10) - replaces the Day 5 hard block. Covers the
 * full lifecycle: HIGH-risk tool call -> PENDING approval -> approve/reject
 * (Employee+ only, per BRD Section 4.2/4.3 as merged 2026-09-13 - see
 * docs/DECISIONS.md) -> executeApprovedTool actually runs the tool and
 * marks the approval EXECUTED (or FAILED).
 */

const PassthroughInput = z.object({ value: z.string(), shouldFail: z.boolean().optional() })
const PassthroughOutput = z.object({ value: z.string() })

describe('security: Approval Engine', () => {
  let orgId: string
  let clientId: string
  let otherClientId: string
  let superAdminId: string
  let accountManagerId: string
  let clientUserId: string // `client` role - lacks approvals.request entirely

  beforeAll(async () => {
    await registerTool({
      key: 'test.approval_gated',
      name: 'Approval-gated test tool',
      provider: 'test',
      description: 'HIGH risk - test only.',
      riskLevel: 'HIGH',
      inputSchema: PassthroughInput,
      outputSchema: PassthroughOutput,
      execute: async (input) => {
        if (input.shouldFail) throw new Error('simulated execution failure')
        return { value: input.value }
      },
    })

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const client = await createTestClient(orgId, 'Approval Test Client')
    clientId = client.id
    const otherClient = await createTestClient(orgId, 'Other Client')
    otherClientId = otherClient.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const accountManager = await createTestUser()
    accountManagerId = accountManager.id
    const amMembership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: accountManagerId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({
      data: { clientId, organizationUserId: amMembership.id },
    })

    const clientUser = await createTestUser()
    clientUserId = clientUser.id
    await testDb.clientUser.create({ data: { clientId, userId: clientUserId } })
  })

  afterAll(async () => {
    await db.toolExecution.deleteMany({ where: { tool: { key: 'test.approval_gated' } } })
    await db.approval.deleteMany({ where: { organizationId: orgId } })
    await cleanupOrg(orgId, [superAdminId, accountManagerId, clientUserId])
    await db.tool.deleteMany({ where: { key: 'test.approval_gated' } })
  })

  it('a HIGH-risk tool call creates a PENDING approval instead of executing', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    let approvalId: string | undefined
    try {
      await executeTool({ ctx: ctx!, toolKey: 'test.approval_gated', input: { value: 'x' }, clientId })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApprovalRequiredError)
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    const approval = await db.approval.findUniqueOrThrow({ where: { id: approvalId! } })
    expect(approval.status).toBe('PENDING')
    expect(approval.riskLevel).toBe('HIGH')

    // No ToolExecution row was created - nothing actually ran.
    const executions = await db.toolExecution.findMany({ where: { clientId, tool: { key: 'test.approval_gated' } } })
    expect(executions).toHaveLength(0)
  })

  // Every employee holds both approvals.request and approvals.approve now
  // (account_manager/marketing_employee merged, docs/DECISIONS.md
  // 2026-09-13) - the remaining role that cannot touch approvals at all is
  // `client`, which lacks approvals.request entirely.
  it('a client cannot list, approve, or reject approvals (lacks approvals.request/approve)', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    let approvalId = ''
    try {
      await executeTool({ ctx: ctx!, toolKey: 'test.approval_gated', input: { value: 'y' }, clientId })
    } catch (error) {
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    const clientCtx = await resolveAuthContext(testDb, clientUserId, orgId)
    await expect(listApprovals(clientCtx!, { clientId })).rejects.toThrow(ForbiddenError)
    await expect(approveApproval(clientCtx!, approvalId)).rejects.toThrow(ForbiddenError)
    await expect(rejectApproval(clientCtx!, approvalId, 'no')).rejects.toThrow(ForbiddenError)
  })

  it('denies approval access for a client the approver is not assigned to', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    let approvalId = ''
    try {
      await executeTool({ ctx: ctx!, toolKey: 'test.approval_gated', input: { value: 'z' }, clientId: otherClientId })
    } catch (error) {
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    // accountManager is assigned to `clientId`, not `otherClientId`.
    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    await expect(approveApproval(amCtx!, approvalId)).rejects.toThrow(ForbiddenError)
  })

  it('an employee approves, and executeApprovedTool actually runs the tool and marks it EXECUTED', async () => {
    const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    let approvalId = ''
    try {
      await executeTool({ ctx: superCtx!, toolKey: 'test.approval_gated', input: { value: 'approve-me' }, clientId })
    } catch (error) {
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    const approved = await approveApproval(amCtx!, approvalId)
    expect(approved.status).toBe('APPROVED')
    expect(approved.approvedBy).toBe(accountManagerId)

    const result = await executeApprovedTool(amCtx!, approvalId)
    expect(result).toEqual({ value: 'approve-me' })

    const finalApproval = await db.approval.findUniqueOrThrow({ where: { id: approvalId } })
    expect(finalApproval.status).toBe('EXECUTED')

    const execution = await db.toolExecution.findFirst({
      where: { clientId, tool: { key: 'test.approval_gated' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(execution?.status).toBe('SUCCEEDED')
  })

  it('marks the approval FAILED if the underlying tool execution throws after approval', async () => {
    const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    let approvalId = ''
    try {
      await executeTool({
        ctx: superCtx!,
        toolKey: 'test.approval_gated',
        input: { value: 'will-fail', shouldFail: true },
        clientId,
      })
    } catch (error) {
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    await approveApproval(amCtx!, approvalId)

    await expect(executeApprovedTool(amCtx!, approvalId)).rejects.toThrow('simulated execution failure')

    const finalApproval = await db.approval.findUniqueOrThrow({ where: { id: approvalId } })
    expect(finalApproval.status).toBe('FAILED')
  })

  it('cannot execute an approval that is still PENDING or was REJECTED', async () => {
    const superCtx = await resolveAuthContext(testDb, superAdminId, orgId)
    let approvalId = ''
    try {
      await executeTool({ ctx: superCtx!, toolKey: 'test.approval_gated', input: { value: 'pending' }, clientId })
    } catch (error) {
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    await expect(executeApprovedTool(superCtx!, approvalId)).rejects.toThrow(/must be APPROVED/)

    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    const rejected = await rejectApproval(amCtx!, approvalId, 'Not worth the risk right now.')
    expect(rejected.status).toBe('REJECTED')
    await expect(executeApprovedTool(amCtx!, approvalId)).rejects.toThrow(/must be APPROVED/)
  })

  it('the original requester can cancel their own pending approval', async () => {
    const amCtx = await resolveAuthContext(testDb, accountManagerId, orgId)
    let approvalId = ''
    try {
      await executeTool({ ctx: amCtx!, toolKey: 'test.approval_gated', input: { value: 'cancel-me' }, clientId })
    } catch (error) {
      approvalId = (error as ApprovalRequiredError).approvalId
    }

    const cancelled = await cancelApproval(amCtx!, approvalId)
    expect(cancelled.status).toBe('CANCELLED')
  })

  it('denies a HIGH-risk tool call with no target client outright (cannot create an Approval without one)', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'test.approval_gated', input: { value: 'no-client' } }),
    ).rejects.toThrow()
  })
})
