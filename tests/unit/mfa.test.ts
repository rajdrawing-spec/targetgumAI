import * as OTPAuth from 'otpauth'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateMfaSecret, verifyMfaToken } from '@/lib/auth/mfa'

beforeAll(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY ??= 'unit-test-key-not-for-production-use'
})

describe('MFA (TOTP)', () => {
  it('verifies a correctly generated token and rejects a bogus one', () => {
    const enrollment = generateMfaSecret('user@example.test')
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(enrollment.base32Secret) })
    const validToken = totp.generate()

    expect(verifyMfaToken(enrollment.encryptedSecret, validToken)).toBe(true)
    expect(verifyMfaToken(enrollment.encryptedSecret, '000000')).toBe(false)
  })

  it('rejects non-6-digit input without attempting decryption', () => {
    const enrollment = generateMfaSecret('user@example.test')
    expect(verifyMfaToken(enrollment.encryptedSecret, 'abcdef')).toBe(false)
    expect(verifyMfaToken(enrollment.encryptedSecret, '12345')).toBe(false)
  })

  it('never exposes the plaintext secret through the encrypted value', () => {
    const enrollment = generateMfaSecret('user@example.test')
    expect(enrollment.encryptedSecret).not.toContain(enrollment.base32Secret)
  })

  it('generates the requested number of unique recovery codes', async () => {
    const { generateRecoveryCodes } = await import('@/lib/auth/mfa')
    const codes = generateRecoveryCodes(10)
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
  })
})
