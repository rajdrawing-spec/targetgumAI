import { SchemaType, type GenerateContentRequest } from '@google/generative-ai'
import type { ZodType, z } from 'zod/v4'
import { db } from '@/lib/db/client'
import { getGeminiClient } from './client'
import { AiGatewayError, InvalidAiOutputError } from './errors'
import { estimateCostCents, MODEL_IDS, type ModelTier } from './models'
import { loadPromptTemplate, renderPromptTemplate } from './prompts'

/**
 * The AI Gateway: the one place application code calls Gemini.
 * Provides model selection, prompt versioning, structured JSON output,
 * token/cost tracking, AI run logging, and retry policy.
 *
 * Uses Gemini's native JSON schema enforcement (responseMimeType: application/json)
 * to guarantee structured output — equivalent to Anthropic's zodOutputFormat.
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

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  // Gemini rate limit errors (429) and server errors (500/503)
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('503') || msg.includes('internal')
}

/**
 * Converts a Zod schema to Gemini's JSON Schema format for structured output.
 * Gemini needs a plain JSON Schema object, not a Zod object.
 */
function zodToGeminiSchema(schema: ZodType): object {
  // Use Zod's built-in JSON Schema export if available (zod/v4 supports this natively)
  const candidate = schema as unknown as { toJSONSchema?: () => object }
  if (typeof candidate.toJSONSchema === 'function') {
    return candidate.toJSONSchema()
  }
  // Fallback: return a generic object schema that accepts any JSON
  return { type: SchemaType.OBJECT }
}

/**
 * Runs one Gemini request constrained to `schema` via native JSON mode,
 * with retry policy for transient API errors.
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

  let geminiClient: ReturnType<typeof getGeminiClient>
  try {
    geminiClient = getGeminiClient()
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown AI Gateway client error.'
    await db.aiRun.update({ where: { id: aiRun.id }, data: { status: 'FAILED', error: message, durationMs } })
    if (error instanceof AiGatewayError) throw error
    throw new AiGatewayError(message)
  }

  const generativeModel = geminiClient.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: zodToGeminiSchema(input.schema) as GenerateContentRequest['generationConfig'] extends { responseSchema?: infer S } ? S : never,
    },
  })

  let lastError: unknown
  for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await generativeModel.generateContent(input.userMessage)
      const response = result.response
      const text = response.text()

      // Parse and validate against the Zod schema
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        lastError = new InvalidAiOutputError('Gemini returned invalid JSON.')
        continue
      }

      const validated = input.schema.safeParse(parsed)
      if (!validated.success) {
        lastError = new InvalidAiOutputError(`Schema validation failed: ${validated.error.message}`)
        if (attempt < DEFAULT_MAX_ATTEMPTS) continue
        break
      }

      const durationMs = Date.now() - startedAt
      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0
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
        data: validated.data,
        aiRunId: aiRun.id,
        usage: { inputTokens, outputTokens, estimatedCostCents },
      }
    } catch (error) {
      lastError = error
      if (error instanceof InvalidAiOutputError) continue
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
