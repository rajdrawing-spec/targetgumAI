import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { executeTool } from '@/lib/tools/execute'
import { registerTool } from '@/lib/tools/registry'
import { ToolOutputValidationError } from '@/lib/tools/errors'
import { db } from '@/lib/db/client'
import { resolveAuthContext } from '@/lib/rbac/context'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

const EchoInput = z.object({ message: z.string() })
const EchoOutput = z.object({ echoed: z.string() })

const BadOutputInput = z.object({ trigger: z.boolean() })
const BadOutputSchema = z.object({ mustHaveThisField: z.string() })

describe('Tool Registry (registration + execution mechanics, real DB)', () => {
  let orgId: string
  let clientId: string
  let userId: string

  beforeAll(async () => {
    await registerTool({
      key: 'test.echo',
      name: 'Echo',
      provider: 'test',
      description: 'Echoes the input message back. Test-only.',
      riskLevel: 'LOW',
      inputSchema: EchoInput,
      outputSchema: EchoOutput,
      execute: async (input) => ({ echoed: input.message }),
    })

    await registerTool({
      key: 'test.bad_output',
      name: 'Bad Output',
      provider: 'test',
      description: 'Always returns output that fails its own schema. Test-only.',
      riskLevel: 'LOW',
      inputSchema: BadOutputInput,
      outputSchema: BadOutputSchema,
      execute: async () => ({ somethingElse: true }) as unknown as { mustHaveThisField: string },
    })

    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Tool Registry Test Client')
    clientId = client.id
    const user = await createTestUser()
    userId = user.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId, roleId: roles.get('super_admin')!.id },
    })
  })

  afterAll(async () => {
    const toolKeys = ['test.echo', 'test.bad_output']
    // ToolExecution rows aren't cascade-deleted with their Tool (Restrict by
    // default) or with the Organization (clientId is SetNull, not Cascade,
    // and organizationId isn't a relation) - delete them first.
    await db.toolExecution.deleteMany({ where: { tool: { key: { in: toolKeys } } } })
    await cleanupOrg(orgId, [userId])
    await db.tool.deleteMany({ where: { key: { in: toolKeys } } })
  })

  it('upserts tool metadata into the Tool table on registration', async () => {
    const row = await db.tool.findFirst({ where: { key: 'test.echo' } })
    expect(row).not.toBeNull()
    expect(row?.riskLevel).toBe('LOW')
    expect(row?.enabled).toBe(true)
  })

  it('re-registering the same tool key upserts rather than duplicating', async () => {
    await registerTool({
      key: 'test.echo',
      name: 'Echo (updated description)',
      provider: 'test',
      description: 'Updated.',
      riskLevel: 'LOW',
      inputSchema: EchoInput,
      outputSchema: EchoOutput,
      execute: async (input) => ({ echoed: input.message }),
    })
    const rows = await db.tool.findMany({ where: { key: 'test.echo' } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Echo (updated description)')
  })

  it('executes a valid, low-risk tool call end to end and records a SUCCEEDED ToolExecution + SUCCESS audit event', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const result = await executeTool({
      ctx: ctx!,
      toolKey: 'test.echo',
      input: { message: 'hello' },
      clientId,
    })

    expect(result).toEqual({ echoed: 'hello' })

    const execution = await db.toolExecution.findFirst({
      where: { organizationId: orgId, clientId },
      orderBy: { createdAt: 'desc' },
    })
    expect(execution?.status).toBe('SUCCEEDED')
    expect(execution?.output).toEqual({ echoed: 'hello' })

    const audit = await db.auditEvent.findFirst({
      where: { organizationId: orgId, action: 'tool.execute.test.echo', result: 'SUCCESS' },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
  })

  it('short-circuits a repeated call with the same idempotencyKey instead of re-executing', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)
    const idempotencyKey = `test-idem-${Date.now()}`

    const first = await executeTool({
      ctx: ctx!,
      toolKey: 'test.echo',
      input: { message: 'first' },
      clientId,
      idempotencyKey,
    })
    const second = await executeTool({
      ctx: ctx!,
      toolKey: 'test.echo',
      // Deliberately different input - if this executed again, the result
      // would differ. It must not.
      input: { message: 'second' },
      clientId,
      idempotencyKey,
    })

    expect(first).toEqual({ echoed: 'first' })
    expect(second).toEqual({ echoed: 'first' }) // returned the cached result, not re-run

    const executions = await db.toolExecution.findMany({ where: { idempotencyKey } })
    expect(executions).toHaveLength(1)
  })

  it('fails a tool whose own output does not satisfy its declared output schema, and audits FAILURE', async () => {
    const ctx = await resolveAuthContext(testDb, userId, orgId)

    await expect(
      executeTool({
        ctx: ctx!,
        toolKey: 'test.bad_output',
        input: { trigger: true },
        clientId,
      }),
    ).rejects.toThrow(ToolOutputValidationError)

    const execution = await db.toolExecution.findFirst({
      where: { organizationId: orgId, clientId, toolId: (await db.tool.findFirstOrThrow({ where: { key: 'test.bad_output' } })).id },
      orderBy: { createdAt: 'desc' },
    })
    expect(execution?.status).toBe('FAILED')

    const audit = await db.auditEvent.findFirst({
      where: { organizationId: orgId, action: 'tool.execute.test.bad_output', result: 'FAILURE' },
    })
    expect(audit).not.toBeNull()
  })
})
