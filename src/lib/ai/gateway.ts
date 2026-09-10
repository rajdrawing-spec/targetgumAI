import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType, z } from 'zod/v4'
import { db } from '@/lib/db/client'
import { getAnthropicClient } from './client'
import { AiGatewayError, InvalidAiOutputError } from './errors'
import { estimateCostCents, MODEL_IDS, type ModelTier } from './models'
import { loadPromptTemplate, renderPromptTemplate } from './prompts'

/**
 * The AI Gateway (BRD-PRD Section 11): the one place application code calls
 * Claude. Provides model selection, prompt/version management, structured
 * output validation, token/cost tracking, AI run logging, and a retry
 * policy - so callers (future agents, Day 9+) never touch the Anthropic SDK
 * directly.
 *
 * Tool permission checking (also listed in Section 11) is intentionally
 * NOT implemented here yet - the Tool Registry doesn't exist until Day 5.
 * `runStructuredAiTask` below does not give Claude any tools; it is a
 * single structured-output call, which is all Day 4's callers need. Wiring
 * agent/tool orchestration through this gateway is Day 5+ work.
 */

const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 500

export interface RunAiTaskInput<Schema extends ZodType> {
  organizationId: string
  clientId?: string
  userId?: string
  /**
   * Reserved for Day 5+: will map to an Agent row once the Tool Registry
   * exists. Recorded on the ai_runs row today only as a label, not a FK -
   * see the agentId note in runStructuredAiTask.
   */
  agentKey?: string
  promptCategory: string
  promptVersion?: string
  /** Interpolated into the versioned prompt template (used as the system prompt). */
  variables?: Record<string, string>
  /** Task-specific content/context sent as the user turn - e.g. assembled Client Brain + real-time data. */
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

function isRetryableError(error: unknown): boolean {
  return (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  )
}

/**
 * Runs one Claude request constrained to `schema` via native structured
 * outputs (`output_config.format`), with the AI Gateway's retry policy
 * (BRD Section 56: "retry where safe, record failure, allow manual retry").
 * Retries transient API errors (rate limit, connection, 5xx) with backoff;
 * non-retryable errors (bad request, auth, etc.) fail immediately. A
 * response that fails schema validation is retried once more before giving
 * up, since it's rare with structured outputs and worth one more attempt.
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
  const client = getAnthropicClient()
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS

  let lastError: unknown
  for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: input.userMessage }],
        output_config: { format: zodOutputFormat(input.schema) },
      })

      if (response.parsed_output === null) {
        lastError = new InvalidAiOutputError()
        continue // one more attempt, same request
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
      if (error instanceof InvalidAiOutputError) continue // already counted as an attempt above
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
