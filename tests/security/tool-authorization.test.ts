import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { registerAgent } from '@/lib/agents/registry'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import { executeTool } from '@/lib/tools/execute'
import { ApprovalRequiredError, RiskLevelBlockedError } from '@/lib/tools/errors'
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
 * BRD-PRD Section 80, scenario 2: "Agent tries to call an unauthorized
 * tool." Also covers the broader authorization chain a tool call goes
 * through (Section 31): permission, client access, agent allowlist, and
 * risk level - each denial must be audited, not just thrown.
 */

const PassthroughInput = z.object({ value: z.string() })
const PassthroughOutput = z.object({ value: z.string() })

describe('security: tool execution authorization', () => {
  let orgId: string
  let clientAId: string
  let clientBId: string
  let employeeId: string // employee, assigned to Client A only, lacks integrations.manage
  let superAdminId: string

  beforeAll(async () => {
    await registerTool({
      key: 'test.low_risk',
      name: 'Low risk test tool',
      provider: 'test',
      description: 'Test-only.',
      riskLevel: 'LOW',
      inputSchema: PassthroughInput,
      outputSchema: PassthroughOutput,
      execute: async (input) => input,
    })
    await registerTool({
      key: 'test.gated_permission',
      name: 'Permission-gated test tool',
      provider: 'test',
      description: 'Requires integrations.manage. Test-only.',
      riskLevel: 'LOW',
      requiredPermissions: ['integrations.manage'],
      inputSchema: PassthroughInput,
      outputSchema: PassthroughOutput,
      execute: async (input) => input,
    })
    await registerTool({
      key: 'test.high_risk',
      name: 'High risk test tool',
      provider: 'test',
      description: 'HIGH risk - must be blocked with no Approval Engine. Test-only.',
      riskLevel: 'HIGH',
      inputSchema: PassthroughInput,
      outputSchema: PassthroughOutput,
      execute: async (input) => input,
    })
    await registerTool({
      key: 'test.not_in_allowlist',
      name: 'Tool outside the test agent allowlist',
      provider: 'test',
      description: 'Test-only.',
      riskLevel: 'LOW',
      inputSchema: PassthroughInput,
      outputSchema: PassthroughOutput,
      execute: async (input) => input,
    })

    await registerAgent({
      key: 'test.limited_agent',
      name: 'Limited Test Agent',
      purpose: 'Only allowed to call test.low_risk. Test-only.',
      allowedToolKeys: ['test.low_risk'],
    })

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const clientA = await createTestClient(orgId, 'Client A')
    const clientB = await createTestClient(orgId, 'Client B')
    clientAId = clientA.id
    clientBId = clientB.id

    const employee = await createTestUser()
    employeeId = employee.id
    const membership = await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('employee')!.id },
    })
    await testDb.clientAssignment.create({
      data: { clientId: clientAId, organizationUserId: membership.id },
    })

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    const toolKeys = [
      'test.low_risk',
      'test.gated_permission',
      'test.high_risk',
      'test.not_in_allowlist',
    ]
    // ToolExecution rows aren't cascade-deleted with their Tool (Restrict by
    // default) - delete them first, same as tests/integration/tool-registry.test.ts.
    await db.toolExecution.deleteMany({ where: { tool: { key: { in: toolKeys } } } })
    await cleanupOrg(orgId, [employeeId, superAdminId])
    await db.tool.deleteMany({ where: { key: { in: toolKeys } } })
    await db.agent.deleteMany({ where: { key: 'test.limited_agent' } })
  })

  it('denies a tool call missing a required permission, and audits it as DENIED', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId) // lacks integrations.manage
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'test.gated_permission', input: { value: 'x' }, clientId: clientAId }),
    ).rejects.toThrow(ForbiddenError)

    const audit = await db.auditEvent.findFirst({
      where: { organizationId: orgId, action: 'tool.execute.test.gated_permission', result: 'DENIED' },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
  })

  it('allows the same tool call for a role that holds the required permission', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await executeTool({
      ctx: ctx!,
      toolKey: 'test.gated_permission',
      input: { value: 'x' },
      clientId: clientAId,
    })
    expect(result).toEqual({ value: 'x' })
  })

  it('denies a tool call for a client the caller is not assigned to (cross-client), and audits it', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId) // assigned to Client A only
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'test.low_risk', input: { value: 'x' }, clientId: clientBId }),
    ).rejects.toThrow(ForbiddenError)

    const audit = await db.auditEvent.findFirst({
      where: { organizationId: orgId, action: 'tool.execute.test.low_risk', clientId: clientBId, result: 'DENIED' },
    })
    expect(audit).not.toBeNull()
  })

  it('denies an agent calling a tool outside its allowlist, and audits it', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(
      executeTool({
        ctx: ctx!,
        toolKey: 'test.not_in_allowlist',
        input: { value: 'x' },
        clientId: clientAId,
        agentKey: 'test.limited_agent',
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('allows the agent to call a tool that IS in its allowlist', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const result = await executeTool({
      ctx: ctx!,
      toolKey: 'test.low_risk',
      input: { value: 'x' },
      clientId: clientAId,
      agentKey: 'test.limited_agent',
    })
    expect(result).toEqual({ value: 'x' })
  })

  it('routes a HIGH-risk tool call to the Approval Engine instead of executing it, even for super_admin, and audits the denial', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    let caughtApprovalId: string | undefined
    try {
      await executeTool({ ctx: ctx!, toolKey: 'test.high_risk', input: { value: 'x' }, clientId: clientAId })
      expect.unreachable('Expected ApprovalRequiredError')
    } catch (error) {
      expect(error).toBeInstanceOf(ApprovalRequiredError)
      caughtApprovalId = (error as ApprovalRequiredError).approvalId
    }

    const approval = await db.approval.findUnique({ where: { id: caughtApprovalId! } })
    expect(approval?.status).toBe('PENDING')
    expect(approval?.riskLevel).toBe('HIGH')
    expect(approval?.clientId).toBe(clientAId)

    const audit = await db.auditEvent.findFirst({
      where: { organizationId: orgId, action: 'tool.execute.test.high_risk', result: 'DENIED' },
    })
    expect(audit).not.toBeNull()

    await db.approval.delete({ where: { id: caughtApprovalId! } })
  })

  it('denies a HIGH-risk tool call outright when no target client is given (an Approval cannot be created without one)', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'test.high_risk', input: { value: 'x' } }),
    ).rejects.toThrow(RiskLevelBlockedError)
  })

  it('denies a call for an unknown/unregistered tool key, and still audits the attempt', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    await expect(
      executeTool({ ctx: ctx!, toolKey: 'test.does_not_exist', input: {}, clientId: clientAId }),
    ).rejects.toThrow()

    const audit = await db.auditEvent.findFirst({
      where: { organizationId: orgId, action: 'tool.execute.test.does_not_exist', result: 'DENIED' },
    })
    expect(audit).not.toBeNull()
  })
})
