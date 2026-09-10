import type { ToolRiskLevel } from '@prisma/client'
import type { ZodType } from 'zod'

/** Runtime context handed to a tool's `execute` function - never includes credentials. */
export interface ToolContext {
  organizationId: string
  clientId?: string
  userId?: string
  agentKey?: string
  workflowRunId?: string
  aiRunId?: string
}

/**
 * A tool's declarative metadata + executable implementation (BRD-PRD
 * Section 13). Metadata is mirrored into the `Tool` table (queryable,
 * governable); the Zod schemas and `execute` function live only in code -
 * Postgres can't store either.
 */
export interface ToolDefinition<Input, Output> {
  /** e.g. "metricool.get_posts" - stable, never reused for a different tool. */
  key: string
  name: string
  provider: string
  description: string
  riskLevel: ToolRiskLevel
  inputSchema: ZodType<Input>
  outputSchema: ZodType<Output>
  /** Permission keys (src/lib/rbac/permissions.ts) the caller must hold. */
  requiredPermissions?: string[]
  /** Client IDs this tool is restricted to, if any. Omit for "any client with the relevant integration." */
  supportedClients?: string[]
  execute: (input: Input, ctx: ToolContext) => Promise<Output>
}
