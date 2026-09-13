import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType, z } from 'zod/v4'
import { db } from '@/lib/db/client'
import { getAnthropicClient } from './client'
import { AiGatewayError, InvalidAiOutputError } from './errors'
import { estimateCostCents, MODEL_IDS, type ModelTier } from './models'
import { loadPromptTemplate, renderPromptTemplate } from './prompts'

/**
 * The AI Gateway: the one place application code calls Claude (BRD-PRD
 * Section 11/113). Provides model selection, prompt versioning, structured
 * JSON output, token/cost tracking, AI run logging, and retry policy.
 *
 * Uses Anthropic's native structured outputs (`output_config.format` +
 * `zodOutputFormat`) via `client.messages.parse()` - see docs/DECISIONS.md
 * ("Structured outputs via native output_config.format, not tool-choice
 * forcing"). `response.parsed_output` is either the validated, correctly-
 * typed object or the call threw - no manual JSON.parse + Zod .safeParse
 * dance.
 */

const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 500

export interface RunAiTaskInput<Schema extends ZodType> {
  organizationId: string
  clientId?: string
  userId?: string
  agentKey?: string
  promptCategory: string
  promptVersion?: string
  /** Interpolated into the versioned prompt template (used as the system prompt). */
  variables?: Record<string, string>
  /** Task-specific content/context sent as the user turn. */
  userMessage: string
  schema: Schema
  tier?: ModelTier
  maxTokens?: number
}

export interface RunAiTaskResult<T> {
  data: T
  aiRunId: string
  usage: {
    inputTokens: number
    outputTokens: number
    estimatedCostCents: number | null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Transport/server-side failures worth retrying - never a 4xx (bad request, auth, etc). */
function isRetryableError(error: unknown): boolean {
  return (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  )
}

/**
 * `zodOutputFormat`'s `.parse()` (invoked internally by `client.messages.parse()`)
 * throws a plain `Anthropic.AnthropicError` - not an `APIError` subclass, since
 * it's a client-side JSON/schema failure, not an HTTP-layer one - when Claude's
 * output doesn't parse as valid JSON or doesn't satisfy the schema. Treated the
 * same as `InvalidAiOutputError` below: worth a retry (model flakiness), never
 * confused with a real `APIError` like `BadRequestError` (which must not retry).
 */
function isStructuredOutputParseError(error: unknown): boolean {
  return error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)
}

/**
 * Runs one Claude request constrained to `schema` via native structured
 * outputs, with retry policy for transient API errors.
 */
export async function runStructuredAiTask<Schema extends ZodType>(
  input: RunAiTaskInput<Schema>,
): Promise<RunAiTaskResult<z.infer<Schema>>> {
  const tier = input.tier ?? 'default'
  const model = MODEL_IDS[tier]
  const { version: promptVersion, content: template } = loadPromptTemplate(
    input.promptCategory,
    input.promptVersion,
  )
  const systemPrompt = renderPromptTemplate(template, input.variables ?? {})

  const aiRun = await db.aiRun.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      userId: input.userId,
      model,
      promptVersion: `${input.promptCategory}/${promptVersion}`,
      contextIds: input.agentKey ? { agentKey: input.agentKey } : undefined,
      status: 'RUNNING',
    },
  })

  const startedAt = Date.now()
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS

  let client: Anthropic
  try {
    client = getAnthropicClient()
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown AI Gateway client error.'
    await db.aiRun.update({ where: { id: aiRun.id }, data: { status: 'FAILED', error: message, durationMs } })
    if (error instanceof AiGatewayError) throw error
    throw new AiGatewayError(message)
  }

  const outputFormat = zodOutputFormat(input.schema)

  let lastError: unknown
  for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: input.userMessage }],
        output_config: { format: outputFormat },
      })

      if (response.parsed_output === null) {
        lastError = new InvalidAiOutputError('Claude response did not match the requested output schema.')
        if (attempt < DEFAULT_MAX_ATTEMPTS) continue
        break
      }

      const durationMs = Date.now() - startedAt
      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const estimatedCostCents = estimateCostCents(tier, inputTokens, outputTokens)

      await db.aiRun.update({
        where: { id: aiRun.id },
        data: {
          status: 'SUCCEEDED',
          inputTokens,
          outputTokens,
          estimatedCostCents: estimatedCostCents ?? undefined,
          durationMs,
        },
      })

      return {
        data: response.parsed_output,
        aiRunId: aiRun.id,
        usage: { inputTokens, outputTokens, estimatedCostCents },
      }
    } catch (error) {
      lastError = error
      if (error instanceof InvalidAiOutputError || isStructuredOutputParseError(error)) continue
      if (!isRetryableError(error) || attempt === DEFAULT_MAX_ATTEMPTS) break
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
    }
  }

  const durationMs = Date.now() - startedAt
  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown AI Gateway failure.'
  await db.aiRun.update({
    where: { id: aiRun.id },
    data: { status: 'FAILED', error: errorMessage, durationMs },
  })

  if (lastError instanceof AiGatewayError) throw lastError
  throw new AiGatewayError(`AI task failed after ${DEFAULT_MAX_ATTEMPTS} attempt(s): ${errorMessage}`)
}
