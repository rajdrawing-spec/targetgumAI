import Anthropic from '@anthropic-ai/sdk'
import { AiGatewayError } from './errors'

/**
 * Lazy Anthropic client singleton. Constructed on first use, not at module
 * import time - the SDK's constructor throws synchronously if no credential
 * source is configured, and importing this module happens in contexts (Next.js
 * build/type-check, unit tests) where ANTHROPIC_API_KEY legitimately isn't
 * set yet. Same pattern as the Nodemailer gotcha in src/lib/auth/config.ts.
 */
let client: Anthropic | undefined

export function getAnthropicClient(): Anthropic {
  if (client) return client

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGatewayError(
      'ANTHROPIC_API_KEY is not configured. Set it in your environment (see .env.example) before running an AI task.',
    )
  }

  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

/**
 * Test-only: inject a stand-in client (e.g. one whose `messages.parse` is a
 * vitest mock) so gateway orchestration logic - retries, ai_runs
 * persistence, error handling - can be tested without a real
 * ANTHROPIC_API_KEY or network access. Never call this outside tests.
 */
export function setAnthropicClientForTests(mockClient: Anthropic): void {
  client = mockClient
}

/** Test-only: reset the cached client (real or injected) between tests. */
export function resetAnthropicClientForTests(): void {
  client = undefined
}
