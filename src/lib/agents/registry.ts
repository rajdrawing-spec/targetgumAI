import { db } from '@/lib/db/client'

/**
 * The Agent Contract (BRD-PRD Section 26). `registerAgent` upserts an
 * Agent row and syncs its AgentTool allowlist to exactly the tool keys
 * listed - adding new ones, removing any that were dropped. Every tool key
 * must already be registered (src/lib/tools/registry.ts registerTool) or
 * this throws; an agent can never be granted a tool that doesn't exist.
 *
 * Same nullable-organizationId caveat as the Tool Registry applies here -
 * see docs/DECISIONS.md.
 */
export interface AgentDefinition {
  key: string
  name: string
  purpose: string
  allowedToolKeys: string[]
  inputSchema?: object
  outputSchema?: object
  riskRules?: object
  clientContextRequirements?: object
}

export async function registerAgent(definition: AgentDefinition): Promise<{ id: string }> {
  const data = {
    name: definition.name,
    purpose: definition.purpose,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    riskRules: definition.riskRules,
    clientContextRequirements: definition.clientContextRequirements,
    enabled: true,
  }

  const existing = await db.agent.findFirst({ where: { organizationId: null, key: definition.key } })
  const agent = existing
    ? await db.agent.update({ where: { id: existing.id }, data })
    : await db.agent.create({ data: { organizationId: null, key: definition.key, ...data } })

  const tools = await db.tool.findMany({ where: { key: { in: definition.allowedToolKeys } } })
  const foundKeys = new Set(tools.map((t) => t.key))
  const missing = definition.allowedToolKeys.filter((key) => !foundKeys.has(key))
  if (missing.length > 0) {
    throw new Error(
      `registerAgent("${definition.key}"): unknown tool key(s) [${missing.join(', ')}] - register the tool(s) first.`,
    )
  }

  await db.agentTool.deleteMany({
    where: { agentId: agent.id, toolId: { notIn: tools.map((t) => t.id) } },
  })
  for (const tool of tools) {
    await db.agentTool.upsert({
      where: { agentId_toolId: { agentId: agent.id, toolId: tool.id } },
      update: {},
      create: { agentId: agent.id, toolId: tool.id },
    })
  }

  return { id: agent.id }
}
