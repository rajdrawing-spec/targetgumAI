import type { Prisma, Tool } from '@prisma/client'
import { approveApproval, createApproval, markApprovalExecuted, markApprovalFailed } from '@/lib/approvals/approvals'
import { recordAuditEvent } from '@/lib/audit/record'
import { db } from '@/lib/db/client'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import type { Permission } from '@/lib/rbac/permissions'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import {
  ApprovalRequiredError,
  RiskLevelBlockedError,
  ToolInputValidationError,
  ToolNotFoundError,
  ToolOutputValidationError,
} from './errors'
import { getToolImplementation } from './registry'
import { ensureToolsRegistered } from './bootstrap'
import type { ToolDefinition } from './types'

/**
 * The single entry point for running a registered tool (BRD-PRD Section 14:
 * "TargetGum must sit between user intent and tool execution"). Walks the
 * full authorization chain from Section 31 before anything runs:
 *
 *   Is user/agent allowed? -> Is tool allowed (enabled)? -> Is client
 *   allowed? -> Is the agent's allowlist satisfied? -> Is the risk level
 *   acceptable? -> validate input -> execute -> validate output -> audit.
 *
 * Every outcome is audited, including denials - never just the successes.
 *
 * HIGH/CRITICAL-risk tools (BRD Section 21) do not execute here - this
 * creates a PENDING Approval (src/lib/approvals/approvals.ts) and throws
 * ApprovalRequiredError. Call `executeApprovedTool` once a human approves
 * it to actually run the tool - see docs/DECISIONS.md for why Day 10
 * replaced the Day 5 hard block with this instead of executing directly.
 *
 * `authorizeCall` calls `ensureToolsRegistered()` (./bootstrap.ts) before
 * looking a tool up - see that file for why this matters (a fresh server
 * process's in-memory tool implementation map starts empty).
 */

export interface ExecuteToolInput {
  ctx: AuthContext
  toolKey: string
  input: unknown
  /** The client this call is acting on behalf of, if any. */
  clientId?: string
  /** Which agent is invoking this tool - checked against its AgentTool allowlist. */
  agentKey?: string
  workflowRunId?: string
  aiRunId?: string
  /** Enables the BRD Section 57 idempotency check: a prior SUCCEEDED execution with the same key is returned as-is, never repeated. */
  idempotencyKey?: string
}

async function denyAndAudit(
  params: ExecuteToolInput,
  toolProvider: string | undefined,
  reason: Error,
): Promise<never> {
  await recordAuditEvent({
    organizationId: params.ctx.organizationId,
    clientId: params.clientId,
    userId: params.ctx.userId,
    action: `tool.execute.${params.toolKey}`,
    provider: toolProvider,
    tool: params.toolKey,
    result: 'DENIED',
    error: reason.message,
  })
  throw reason
}

interface AuthorizedCall {
  toolRow: Tool
  impl: ToolDefinition<unknown, unknown>
  agentId: string | undefined
  parsedInput: { data: unknown }
}

/**
 * Runs the full authorization + input-validation chain, short of actually
 * executing. Shared by `executeTool` (fresh calls, risk gate active) and
 * `executeApprovedTool` (resuming an approved HIGH/CRITICAL call, risk
 * gate skipped - the Approval itself is the accepted risk decision).
 */
async function authorizeCall(
  params: ExecuteToolInput,
  options: { skipRiskGate: boolean },
): Promise<AuthorizedCall> {
  const { ctx, toolKey } = params

  await ensureToolsRegistered()
  const toolRow = await db.tool.findFirst({ where: { key: toolKey, enabled: true } })
  const impl = getToolImplementation(toolKey)
  if (!toolRow || !impl) {
    return denyAndAudit(params, toolRow?.provider, new ToolNotFoundError(toolKey))
  }

  const requiredPermissions = (toolRow.requiredPermissions as Prisma.JsonValue | null) ?? []
  if (Array.isArray(requiredPermissions)) {
    try {
      for (const permission of requiredPermissions) {
        assertPermission(ctx, permission as Permission)
      }
    } catch (error) {
      return denyAndAudit(params, toolRow.provider, error as Error)
    }
  }

  if (params.clientId) {
    const client = await db.client.findUnique({ where: { id: params.clientId } })
    if (!client) {
      return denyAndAudit(params, toolRow.provider, new ForbiddenError('Not authorized for this client.'))
    }
    try {
      assertClientAccess(ctx, client)
    } catch (error) {
      return denyAndAudit(params, toolRow.provider, error as Error)
    }

    const supportedClients = toolRow.supportedClients as Prisma.JsonValue | null
    if (Array.isArray(supportedClients) && !supportedClients.includes(params.clientId)) {
      return denyAndAudit(
        params,
        toolRow.provider,
        new ForbiddenError(`Tool "${toolKey}" is not enabled for this client.`),
      )
    }
  }

  let agentId: string | undefined
  if (params.agentKey) {
    const agent = await db.agent.findFirst({ where: { key: params.agentKey, enabled: true } })
    if (!agent) {
      return denyAndAudit(
        params,
        toolRow.provider,
        new ForbiddenError(`Unknown or disabled agent "${params.agentKey}".`),
      )
    }
    const allowlisted = await db.agentTool.findUnique({
      where: { agentId_toolId: { agentId: agent.id, toolId: toolRow.id } },
    })
    if (!allowlisted) {
      return denyAndAudit(
        params,
        toolRow.provider,
        new ForbiddenError(`Agent "${params.agentKey}" is not allowed to call tool "${toolKey}".`),
      )
    }
    agentId = agent.id
  }

  if (!options.skipRiskGate && (toolRow.riskLevel === 'HIGH' || toolRow.riskLevel === 'CRITICAL')) {
    // An Approval always belongs to a client (required field, BRD Section
    // 22) - a HIGH/CRITICAL tool call with no target client can't be
    // approved at all, so it's denied outright rather than attempting an
    // invalid Approval row.
    if (!params.clientId) {
      return denyAndAudit(
        params,
        toolRow.provider,
        new RiskLevelBlockedError(toolKey, toolRow.riskLevel),
      )
    }

    let approvalId: string
    try {
      const approval = await createApproval({
        organizationId: ctx.organizationId,
        clientId: params.clientId,
        requestedBy: ctx.userId,
        agentId,
        workflowRunId: params.workflowRunId,
        actionType: `tool.execute.${toolKey}`,
        riskLevel: toolRow.riskLevel,
        actionSummary: toolRow.name,
        proposedChanges: {
          toolKey,
          input: params.input as Prisma.InputJsonValue,
          clientId: params.clientId,
          agentKey: params.agentKey,
          workflowRunId: params.workflowRunId,
          aiRunId: params.aiRunId,
          idempotencyKey: params.idempotencyKey,
        },
      })
      approvalId = approval.id
    } catch {
      return denyAndAudit(params, toolRow.provider, new RiskLevelBlockedError(toolKey, toolRow.riskLevel))
    }
    return denyAndAudit(params, toolRow.provider, new ApprovalRequiredError(toolKey, toolRow.riskLevel, approvalId))
  }

  const parsedInput = impl.inputSchema.safeParse(params.input)
  if (!parsedInput.success) {
    return denyAndAudit(
      params,
      toolRow.provider,
      new ToolInputValidationError(toolKey, parsedInput.error.message),
    )
  }

  return { toolRow, impl, agentId, parsedInput }
}

async function runAuthorizedTool(params: ExecuteToolInput, authorized: AuthorizedCall): Promise<unknown> {
  const { ctx, toolKey } = params
  const { toolRow, impl, agentId, parsedInput } = authorized

  const execution = await db.toolExecution.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: params.clientId,
      toolId: toolRow.id,
      agentId,
      aiRunId: params.aiRunId,
      workflowRunId: params.workflowRunId,
      userId: ctx.userId,
      input: parsedInput.data as Prisma.InputJsonValue,
      idempotencyKey: params.idempotencyKey,
      status: 'PENDING',
    },
  })

  try {
    const rawOutput = await impl.execute(parsedInput.data, {
      organizationId: ctx.organizationId,
      clientId: params.clientId,
      userId: ctx.userId,
      agentKey: params.agentKey,
      workflowRunId: params.workflowRunId,
      aiRunId: params.aiRunId,
    })

    const parsedOutput = impl.outputSchema.safeParse(rawOutput)
    if (!parsedOutput.success) {
      throw new ToolOutputValidationError(toolKey, parsedOutput.error.message)
    }

    await db.toolExecution.update({
      where: { id: execution.id },
      data: { status: 'SUCCEEDED', output: parsedOutput.data as Prisma.InputJsonValue },
    })
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId: params.clientId,
      userId: ctx.userId,
      agentId,
      aiRunId: params.aiRunId,
      toolExecutionId: execution.id,
      action: `tool.execute.${toolKey}`,
      provider: toolRow.provider,
      tool: toolKey,
      inputSummary: parsedInput.data as object,
      outputSummary: parsedOutput.data as object,
      riskLevel: toolRow.riskLevel,
      result: 'SUCCESS',
    })

    return parsedOutput.data
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown tool execution failure.'
    await db.toolExecution.update({
      where: { id: execution.id },
      data: { status: 'FAILED', error: message },
    })
    await recordAuditEvent({
      organizationId: ctx.organizationId,
      clientId: params.clientId,
      userId: ctx.userId,
      agentId,
      aiRunId: params.aiRunId,
      toolExecutionId: execution.id,
      action: `tool.execute.${toolKey}`,
      provider: toolRow.provider,
      tool: toolKey,
      inputSummary: parsedInput.data as object,
      riskLevel: toolRow.riskLevel,
      result: 'FAILURE',
      error: message,
    })
    throw error
  }
}

export async function executeTool(params: ExecuteToolInput): Promise<unknown> {
  if (params.idempotencyKey) {
    const priorExecution = await db.toolExecution.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    })
    if (priorExecution?.status === 'SUCCEEDED') {
      return priorExecution.output
    }
  }

  const authorized = await authorizeCall(params, { skipRiskGate: false })
  return runAuthorizedTool(params, authorized)
}

interface ApprovedToolCallParams {
  toolKey: string
  input: unknown
  clientId?: string
  agentKey?: string
  workflowRunId?: string
  aiRunId?: string
  idempotencyKey?: string
}

/**
 * Runs a tool call that was previously blocked by the risk gate, now that
 * its Approval is APPROVED. Re-runs the full authorization chain (BRD
 * Section 31 still applies in full - permissions/client access/agent
 * allowlist are re-checked, not just trusted from when the approval was
 * created) except the risk-level gate itself, since the approval IS that
 * decision. Marks the approval EXECUTED or FAILED on the way out.
 */
export async function executeApprovedTool(ctx: AuthContext, approvalId: string): Promise<unknown> {
  const approval = await db.approval.findUnique({ where: { id: approvalId } })
  if (!approval || approval.organizationId !== ctx.organizationId) {
    throw new ForbiddenError('Not authorized for this approval.')
  }
  if (approval.status !== 'APPROVED') {
    throw new Error(`Cannot execute an approval in status ${approval.status} - it must be APPROVED first.`)
  }

  const stored = approval.proposedChanges as unknown as ApprovedToolCallParams
  if (!stored?.toolKey) {
    throw new Error('This approval was not created for a tool call and cannot be executed via executeApprovedTool.')
  }

  const params: ExecuteToolInput = {
    ctx,
    toolKey: stored.toolKey,
    input: stored.input,
    clientId: stored.clientId,
    agentKey: stored.agentKey,
    workflowRunId: stored.workflowRunId,
    aiRunId: stored.aiRunId,
    idempotencyKey: stored.idempotencyKey,
  }

  try {
    const authorized = await authorizeCall(params, { skipRiskGate: true })
    const result = await runAuthorizedTool(params, authorized)
    await markApprovalExecuted(approvalId)
    return result
  } catch (error) {
    await markApprovalFailed(approvalId)
    throw error
  }
}

/**
 * What "click Approve" on `/dashboard/approvals` actually calls (Phase 2 -
 * BRD Section 85's "automated social scheduling" is what surfaced this was
 * missing). Before this, `approveApproval` (src/lib/approvals/approvals.ts)
 * only ever flipped an Approval's status to APPROVED - nothing in the app
 * ever called `executeApprovedTool` afterward, so a HIGH/CRITICAL tool
 * call an approver "approved" never actually ran. Not caught earlier
 * because no HIGH-risk tool existed with a real, live-verifiable
 * execution path to notice the gap through - `metricool.publish_post` is
 * the first one.
 *
 * Approves, then executes only if the approval was actually created for a
 * tool call (`proposedChanges.toolKey` present, same shape
 * `executeApprovedTool` already expects) - an approval routed from
 * something else (e.g. a recommendation, which has no toolKey) is left as
 * approved-only, exactly as before. Returns the final approval row so the
 * caller sees APPROVED, EXECUTED, or FAILED, not a stale APPROVED that's
 * about to change underneath it.
 */
export async function approveAndExecuteApproval(ctx: AuthContext, approvalId: string) {
  const approved = await approveApproval(ctx, approvalId)
  const proposedChanges = approved.proposedChanges as unknown as ApprovedToolCallParams | null
  if (!proposedChanges?.toolKey) return approved

  await executeApprovedTool(ctx, approvalId) // marks EXECUTED or FAILED itself; a FAILED execution still throws, same as executeApprovedTool always has
  return db.approval.findUniqueOrThrow({ where: { id: approvalId } })
}
