import type { Prisma } from '@prisma/client'
import { recordAuditEvent } from '@/lib/audit/record'
import { db } from '@/lib/db/client'
import { assertClientAccess, assertPermission } from '@/lib/rbac/guards'
import type { Permission } from '@/lib/rbac/permissions'
import { ForbiddenError } from '@/lib/rbac/errors'
import type { AuthContext } from '@/lib/rbac/types'
import {
  RiskLevelBlockedError,
  ToolInputValidationError,
  ToolNotFoundError,
  ToolOutputValidationError,
} from './errors'
import { getToolImplementation } from './registry'

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

export async function executeTool(params: ExecuteToolInput): Promise<unknown> {
  const { ctx, toolKey } = params

  if (params.idempotencyKey) {
    const priorExecution = await db.toolExecution.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    })
    if (priorExecution?.status === 'SUCCEEDED') {
      return priorExecution.output
    }
  }

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

  if (toolRow.riskLevel === 'HIGH' || toolRow.riskLevel === 'CRITICAL') {
    return denyAndAudit(params, toolRow.provider, new RiskLevelBlockedError(toolKey, toolRow.riskLevel))
  }

  const parsedInput = impl.inputSchema.safeParse(params.input)
  if (!parsedInput.success) {
    return denyAndAudit(
      params,
      toolRow.provider,
      new ToolInputValidationError(toolKey, parsedInput.error.message),
    )
  }

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
