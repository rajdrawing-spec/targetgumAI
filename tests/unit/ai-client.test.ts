import { afterEach, describe, expect, it } from 'vitest'
import { getGeminiClient, resetGeminiClientForTests } from '@/lib/ai/client'
import { AiGatewayError } from '@/lib/ai/errors'

describe('getGeminiClient', () => {
  const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

  afterEach(() => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey
    resetGeminiClientForTests()
  })

  it('throws a clear AiGatewayError instead of an SDK crash when no API key is configured', () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GEMINI_API_KEY
    resetGeminiClientForTests()
    expect(() => getGeminiClient()).toThrow(AiGatewayError)
  })

  it('constructs successfully once an API key is present', () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'AIzaSyFakeKeyForTesting123'
    resetGeminiClientForTests()
    expect(() => getGeminiClient()).not.toThrow()
  })
})
