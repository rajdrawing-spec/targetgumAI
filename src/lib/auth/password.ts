import bcrypt from 'bcryptjs'

// bcryptjs (pure JS, no native bindings) over argon2/native bcrypt - see
// docs/DECISIONS.md. Cost factor 12 is a reasonable default as of 2026;
// revisit if login latency or hardware changes warrant it.
const SALT_ROUNDS = 12

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS)
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}
