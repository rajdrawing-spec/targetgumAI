import Anthropic from '@anthropic-ai/sdk'
import { afterAll, afterEach, describe, expect, it, vi, beforeAll } from 'vitest'
import { z } from 'zod/v4'
import { resetAnthropicClientForTests, setAnthropicClientForTests } from '@/lib/ai/client'
import { AiGatewayError } from '@/lib/ai/errors'
import { runStructuredAiTask } from '@/lib/ai/gateway'
import { db } from '@/lib/db/client'
import { cleanupOrg, createTestClient, createTestOrg } from '../helpers/factory'

const OutputSchema = z.object({ ok: z.boolean(), note: z.string() })

function fakeUsage(inputTokens: number, outputTokens: number) {
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    cache_creation: null,
    inference_geo: null,
    server_tool_use: null,
    service_tier: null,
  }
}

/** Installs a fake Anthropic client whose `messages.parse` is a controllable mock, and returns that mock. */
function mockParse() {
  const parse = vi.fn()
  const fakeClient = { messages: { parse } } as unknown as Anthropic
  setAnthropicClientForTests(fakeClient)
  return parse
}

describe('AI Gateway: runStructuredAiTask (real DB, injected fake Anthropic client)', () => {
  let orgId: string
  let clientId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const client = await createTestClient(orgId, 'Gateway Test Client')
    clientId = client.id
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
  })

  afterEach(() => {
    resetAnthropicClientForTests()
    vi.restoreAllMocks()
  })

  it('succeeds on the first attempt and persists a SUCCEEDED ai_runs row with usage/cost', async () => {
    const parse = mockParse()
    parse.mockResolvedValueOnce({
      parsed_output: { ok: true, note: 'looks good' },
      usage: fakeUsage(100, 50),
    })

    const result = await runStructuredAiTask({
      organizationId: orgId,
      clientId,
      promptCategory: 'reporting',
      variables: {},
      userMessage: 'Test input',
      schema: OutputSchema,
    })

    expect(result.data).toEqual({ ok: true, note: 'looks good' })
    expect(result.usage.inputTokens).toBe(100)
    expect(result.usage.outputTokens).toBe(50)
    expect(result.usage.estimatedCostCents).not.toBeNull()
    expect(parse).toHaveBeenCalledTimes(1)

    const run = await db.aiRun.findUniqueOrThrow({ where: { id: result.aiRunId } })
    expect(run.status).toBe('SUCCEEDED')
    expect(run.promptVersion).toBe('reporting/v1')
    expect(run.inputTokens).toBe(100)
    expect(run.outputTokens).toBe(50)
  })

  it('retries a transient error and succeeds, recording only the final outcome', async () => {
    const parse = mockParse()
    parse
      .mockRejectedValueOnce(new Anthropic.RateLimitError(429, {}, 'simulated rate limit', new Headers()))
      .mockResolvedValueOnce({
        parsed_output: { ok: true, note: 'succeeded after retry' },
        usage: fakeUsage(10, 10),
      })

    const result = await runStructuredAiTask({
      organizationId: orgId,
      clientId,
      promptCategory: 'reporting',
      variables: {},
      userMessage: 'Test input',
      schema: OutputSchema,
    })

    expect(result.data.note).toBe('succeeded after retry')
    expect(parse).toHaveBeenCalledTimes(2)

    const run = await db.aiRun.findUniqueOrThrow({ where: { id: result.aiRunId } })
    expect(run.status).toBe('SUCCEEDED')
  })

  it('does not retry a non-retryable error and fails immediately', async () => {
    const parse = mockParse()
    parse.mockRejectedValueOnce(
      new Anthropic.BadRequestError(400, {}, 'simulated bad request', new Headers()),
    )

    await expect(
      runStructuredAiTask({
        organizationId: orgId,
        clientId,
        promptCategory: 'reporting',
        variables: {},
        userMessage: 'Test input',
        schema: OutputSchema,
      }),
    ).rejects.toThrow(AiGatewayError)

    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('retries once on invalid structured output, then succeeds', async () => {
    const parse = mockParse()
    parse
      .mockResolvedValueOnce({ parsed_output: null, usage: fakeUsage(5, 5) })
      .mockResolvedValueOnce({
        parsed_output: { ok: true, note: 'valid this time' },
        usage: fakeUsage(5, 5),
      })

    const result = await runStructuredAiTask({
      organizationId: orgId,
      clientId,
      promptCategory: 'reporting',
      variables: {},
      userMessage: 'Test input',
      schema: OutputSchema,
    })

    expect(result.data.note).toBe('valid this time')
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it('marks the ai_runs row FAILED after exhausting all retries', async () => {
    const parse = mockParse()
    parse.mockRejectedValue(
      new Anthropic.RateLimitError(429, {}, 'simulated persistent rate limit', new Headers()),
    )

    await expect(
      runStructuredAiTask({
        organizationId: orgId,
        clientId,
        promptCategory: 'reporting',
        variables: {},
        userMessage: 'Test input',
        schema: OutputSchema,
      }),
    ).rejects.toThrow(AiGatewayError)

    expect(parse).toHaveBeenCalledTimes(3) // DEFAULT_MAX_ATTEMPTS

    const runs = await db.aiRun.findMany({
      where: { organizationId: orgId, clientId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    expect(runs[0]?.status).toBe('FAILED')
    expect(runs[0]?.error).toBeTruthy()
  })

  it('marks the ai_runs row FAILED (not stuck at RUNNING) when the Anthropic client itself can\'t be built - e.g. ANTHROPIC_API_KEY missing (found live during Phase 2 Canva creative workflow verification, docs/DECISIONS.md)', async () => {
    // Deliberately no mockParse()/setAnthropicClientForTests() call - this
    // exercises the real getAnthropicClient(), which throws synchronously
    // before the retry loop's own try/catch (this is the bug: that throw
    // used to happen after the ai_runs row was created but wasn't wrapped
    // in anything that could mark it FAILED).
    resetAnthropicClientForTests()

    await expect(
      runStructuredAiTask({
        organizationId: orgId,
        clientId,
        promptCategory: 'reporting',
        variables: {},
        userMessage: 'Test input',
        schema: OutputSchema,
      }),
    ).rejects.toThrow(AiGatewayError)

    const runs = await db.aiRun.findMany({
      where: { organizationId: orgId, clientId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    expect(runs[0]?.status).toBe('FAILED')
    expect(runs[0]?.error).toContain('ANTHROPIC_API_KEY')
  })
})
