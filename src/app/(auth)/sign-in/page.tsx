'use client'

import { signIn } from 'next-auth/react'
import { useState, type FormEvent } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

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

    // Root route resolves to /dashboard or /portal depending on role.
    window.location.href = '/'
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">TargetGum</h1>
            <p className="text-sm text-muted-foreground">AI Marketing OS</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                disabled={needsMfa}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                disabled={needsMfa}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {needsMfa && (
              <div>
                <Label htmlFor="totpCode">Authenticator code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive-bg px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? 'Signing in…' : needsMfa ? 'Verify' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
