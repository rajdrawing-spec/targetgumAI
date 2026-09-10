import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Envelope encryption for values that must never sit in the database as
 * plaintext: OAuth refresh tokens/integration credentials (src/lib/integrations/*)
 * and MFA TOTP secrets (src/lib/auth/mfa.ts). See docs/SECURITY.md.
 *
 * AES-256-GCM with a key derived from INTEGRATION_ENCRYPTION_KEY. In
 * production this env var should be a reference resolved by the secrets
 * manager, not a literal value (docs/ARCHITECTURE.md) - a KMS-backed
 * envelope (e.g. re-wrapping this key with AWS KMS/GCP KMS) is a follow-up,
 * not implemented here.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // recommended for GCM

function getKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY is not set. Required to encrypt/decrypt stored secrets.',
    )
  }
  // Derive a fixed-length key regardless of the raw secret's length/format.
  return createHash('sha256').update(secret).digest()
}

/** Returns `<iv>:<authTag>:<ciphertext>`, all base64. */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  )
}

export function decryptSecret(encoded: string): string {
  const key = getKey()
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted value.')
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
