import { beforeAll, describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from '@/lib/crypto/envelope'

beforeAll(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY ??= 'unit-test-key-not-for-production-use'
})

describe('envelope encryption', () => {
  it('round-trips a secret', () => {
    const encrypted = encryptSecret('super-secret-value')
    expect(encrypted).not.toContain('super-secret-value')
    expect(decryptSecret(encrypted)).toBe('super-secret-value')
  })

  it('produces different ciphertext for the same plaintext (random IV per call)', () => {
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same-value')
    expect(decryptSecret(b)).toBe('same-value')
  })

  it('fails to decrypt a tampered ciphertext (GCM auth tag check)', () => {
    const encrypted = encryptSecret('secret')
    const [iv, authTag, ciphertext] = encrypted.split(':')
    const tampered = [iv, authTag, Buffer.from(`${ciphertext}x`).toString('base64')].join(':')
    expect(() => decryptSecret(tampered)).toThrow()
  })
})
