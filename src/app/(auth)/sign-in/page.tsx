'use client'

import { signIn } from 'next-auth/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  invalid_mfa: 'Invalid authenticator code.',
  google_not_invited: "That Google account isn't linked to a TargetGum user yet. Ask your Super Admin to invite you first, then try again.",
  OAuthAccountNotLinked: 'That email already has a different sign-in method. Use your password instead.',
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    // The Google button only exists when the provider is actually
    // registered (src/lib/auth/config.ts's isGoogleLoginConfigured) -
    // /api/auth/providers is Auth.js's own list of what's live, so this
    // never offers a control that can't work (docs/SECURITY.md).
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((providers) => setGoogleEnabled(Boolean(providers?.google)))
      .catch(() => setGoogleEnabled(false))

    const code = new URLSearchParams(window.location.search).get('error')
    if (code) setError(ERROR_MESSAGES[code] ?? 'Sign-in failed.')
  }, [])

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

      <ThemeToggle className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-6 sm:top-6" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-glow">
            <img
              src="/logo.jpg"
              alt="TargetGum Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
              Target<span className="text-primary">Gum</span>
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Precision Marketing. Real Results.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive-bg px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {googleEnabled && (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={googleSubmitting}
                onClick={() => {
                  setGoogleSubmitting(true)
                  signIn('google', { callbackUrl: '/' })
                }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.63v3h3.89c2.28-2.1 3.59-5.2 3.59-8.82Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1C3.26 21.3 7.31 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.29 14.3A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.39-2.3v-3.1H1.28A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.28 5.4l4.01-3.1Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.6 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.6l4.01 3.1c.94-2.83 3.59-4.95 6.71-4.95Z" />
                </svg>
                {googleSubmitting ? 'Redirecting…' : 'Continue with Google'}
              </Button>

              <div className="my-4 flex items-center gap-3 text-xs text-caption">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

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

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? 'Signing in…' : needsMfa ? 'Verify' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
