import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password hashing', () => {
  it('verifies a correct password and rejects an incorrect one', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('never stores the plaintext password in the hash', async () => {
    const hash = await hashPassword('super-secret-password')
    expect(hash).not.toContain('super-secret-password')
  })
})
