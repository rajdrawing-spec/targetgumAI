import { afterEach, describe, expect, it } from 'vitest'
import { getAnthropicClient, resetAnthropicClientForTests } from '@/lib/ai/client'
import { AiGatewayError } from '@/lib/ai/errors'

describe('getAnthropicClient', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey
    resetAnthropicClientForTests()
  })

  it('throws a clear AiGatewayError instead of an SDK crash when no API key is configured', () => {
    delete process.env.ANTHROPIC_API_KEY
    resetAnthropicClientForTests()
    expect(() => getAnthropicClient()).toThrow(AiGatewayError)
  })

  it('constructs successfully once an API key is present', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fakeKeyForTesting123'
    resetAnthropicClientForTests()
    expect(() => getAnthropicClient()).not.toThrow()
  })
})
