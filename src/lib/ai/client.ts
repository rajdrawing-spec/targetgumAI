import { GoogleGenerativeAI } from '@google/generative-ai'
import { AiGatewayError } from './errors'

/**
 * Lazy Google Gemini client singleton. Constructed on first use, not at module
 * import time - avoids throwing at build/typecheck time when the key isn't set.
 */
let genAI: GoogleGenerativeAI | undefined

export function getGeminiClient(): GoogleGenerativeAI {
  if (genAI) return genAI

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new AiGatewayError(
      'GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not configured. Set it in your .env.local file.',
    )
  }

  genAI = new GoogleGenerativeAI(apiKey)
  return genAI
}

/** Test-only: reset the cached client between tests. */
export function resetGeminiClientForTests(): void {
  genAI = undefined
}

/** Legacy test-only helpers for integration tests */
export function resetAnthropicClientForTests(): void {
  genAI = undefined
}

export function setAnthropicClientForTests(_client: any): void {
  // no-op for Gemini migration
}
