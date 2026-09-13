import Anthropic from '@anthropic-ai/sdk'
import { AiGatewayError } from './errors'

/**
 * Lazy Anthropic client singleton. Constructed on first use, not at module
 * import time - avoids throwing at build/typecheck time when the key isn't
 * set (see docs/DECISIONS.md).
 */
let anthropic: Anthropic | undefined

export function getAnthropicClient(): Anthropic {
  if (anthropic) return anthropic

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AiGatewayError('ANTHROPIC_API_KEY is not configured. Set it in your .env.local file.')
  }

  anthropic = new Anthropic({ apiKey })
  return anthropic
}

/** Test-only: reset the cached client between tests. */
export function resetAnthropicClientForTests(): void {
  anthropic = undefined
}

/** Test-only: inject a fake/mock client, bypassing ANTHROPIC_API_KEY entirely. */
export function setAnthropicClientForTests(client: Anthropic): void {
  anthropic = client
}
