import { randomBytes } from 'crypto'
import * as OTPAuth from 'otpauth'
import { decryptSecret, encryptSecret } from '@/lib/crypto/envelope'

/**
 * TOTP-based MFA (docs/BRD-PRD.md Section 9 requires "MFA capability"; Auth.js
 * has no built-in MFA - see docs/DECISIONS.md). The generated secret is
 * envelope-encrypted before it's ever written to `User.mfaSecret` - callers
 * must not persist the plaintext value returned by `generateMfaSecret`.
 */

const ISSUER = 'TargetGum AI Marketing OS'
const VALIDATION_WINDOW = 1 // +/- 1 period (30s) of clock drift tolerance

export interface MfaEnrollment {
  /** Plaintext secret - only for rendering the QR/manual-entry code during enrollment. Never store this. */
  base32Secret: string
  /** Envelope-encrypted secret - safe to persist to User.mfaSecret. */
  encryptedSecret: string
  /** otpauth:// URI for QR code generation on the client. */
  otpauthUri: string
}

export function generateMfaSecret(accountEmail: string): MfaEnrollment {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  })

  return {
    base32Secret: totp.secret.base32,
    encryptedSecret: encryptSecret(totp.secret.base32),
    otpauthUri: totp.toString(),
  }
}

/**
 * Verifies a 6-digit TOTP code against an envelope-encrypted secret
 * (as stored in User.mfaSecret).
 */
export function verifyMfaToken(encryptedSecret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false

  const base32Secret = decryptSecret(encryptedSecret)
  const delta = OTPAuth.TOTP.validate({
    token,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    window: VALIDATION_WINDOW,
  })

  return delta !== null
}

/** One-time recovery codes shown once at enrollment, for when the device is lost. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString('hex'))
}
