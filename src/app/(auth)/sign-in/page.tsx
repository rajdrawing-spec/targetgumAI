'use client'

import { signIn } from 'next-auth/react'
import { useState, type FormEvent } from 'react'

/**
 * Minimal credentials sign-in form, enough to exercise the auth/MFA flow
 * end-to-end (Day 3 of docs/MVP-CHECKLIST.md). The real dashboard shell and
 * design pass land later - this intentionally stays plain.
 */

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  invalid_mfa: 'Invalid authenticator code.',
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await signIn('credentials', {
      email,
      password,
      totpCode: needsMfa ? totpCode : undefined,
      redirect: false,
    })

    setSubmitting(false)

    if (result?.error) {
      if (result.code === 'mfa_required') {
        setNeedsMfa(true)
        return
      }
      setError(ERROR_MESSAGES[result.code ?? ''] ?? 'Sign-in failed.')
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm text-gray-600">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            disabled={needsMfa}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm text-gray-600">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            disabled={needsMfa}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {needsMfa && (
          <div className="space-y-1">
            <label htmlFor="totpCode" className="block text-sm text-gray-600">
              Authenticator code
            </label>
            <input
              id="totpCode"
              type="text"
              inputMode="numeric"
              autoFocus
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {needsMfa ? 'Verify' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
