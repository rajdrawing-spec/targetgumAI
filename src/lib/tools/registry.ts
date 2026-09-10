import { db } from '@/lib/db/client'
import type { ToolDefinition } from './types'

/**
 * The Tool Registry (BRD-PRD Section 13). `registerTool` does two things:
 * upserts the tool's declarative metadata into the `Tool` table (so it's
 * queryable/governable - enable/disable, risk level, required permissions),
 * and stores its executable implementation in this in-memory map (schemas
 * and functions can't live in Postgres). Call it once per tool, typically
 * at module load time in that provider's own module (e.g.
 * src/lib/integrations/metricool/tools.ts, Day 6) - it's idempotent, safe
 * to call on every process start.
 *
 * Note: `Tool.organizationId` is nullable for system-wide tools, and
 * Postgres doesn't enforce uniqueness across NULLs in a compound unique
 * index - `@@unique([organizationId, key])` won't catch two system-wide
 * tools registered with the same key from a race. That's fine for this
 * app's registration pattern (idempotent calls at single-process startup,
 * never concurrent), but would need a partial unique index
 * (`WHERE organization_id IS NULL`) if registration ever needs to be
 * concurrency-safe - see docs/DECISIONS.md.
 */

const implementations = new Map<string, ToolDefinition<unknown, unknown>>()

export async function registerTool<Input, Output>(
  definition: ToolDefinition<Input, Output>,
): Promise<void> {
  implementations.set(definition.key, definition as unknown as ToolDefinition<unknown, unknown>)

  const data = {
    name: definition.name,
    provider: definition.provider,
    description: definition.description,
    riskLevel: definition.riskLevel,
    inputSchema: {}, // JSON Schema export of inputSchema is a nice-to-have, not needed for enforcement (which uses the in-memory Zod object directly)
    outputSchema: {},
    requiredPermissions: definition.requiredPermissions ?? undefined,
    supportedClients: definition.supportedClients ?? undefined,
    enabled: true,
  }

  const existing = await db.tool.findFirst({
    where: { organizationId: null, key: definition.key },
  })

  if (existing) {
    await db.tool.update({ where: { id: existing.id }, data })
  } else {
    await db.tool.create({ data: { organizationId: null, key: definition.key, ...data } })
  }
}

export function getToolImplementation(
  key: string,
): ToolDefinition<unknown, unknown> | undefined {
  return implementations.get(key)
}

/** Test-only: clear registered implementations between test files/suites. */
export function _resetToolRegistryForTests(): void {
  implementations.clear()
}
