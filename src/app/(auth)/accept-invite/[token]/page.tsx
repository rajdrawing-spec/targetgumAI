import Link from 'next/link'
import { Sparkles, AlertCircle } from 'lucide-react'
import { getInvitationByToken } from '@/lib/users/invitations'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { Input, Label } from '@/components/ui/input'
import { acceptInvitationAction } from './actions'

const ROLE_LABEL: Record<string, string> = { employee: 'an Employee', client: 'a Client' }

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)

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
            <h1 className="text-lg font-medium tracking-tight text-foreground">TargetGum</h1>
            <p className="text-sm text-muted-foreground">AI Marketing OS</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          {!invitation ? (
            <div className="flex items-start gap-2 rounded-md bg-destructive-bg px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This invitation link is invalid or has expired. Ask whoever invited you to send a new one.{' '}
                <Link href="/sign-in" className="underline">
                  Back to sign in
                </Link>
              </span>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                You&apos;ve been invited to join <strong className="text-foreground">{invitation.organizationName}</strong> as{' '}
                {ROLE_LABEL[invitation.role] ?? invitation.role}. Set a password to activate <strong className="text-foreground">{invitation.email}</strong>.
              </p>
              <ActionForm action={acceptInvitationAction.bind(null, token)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" required autoFocus placeholder="Full name" />
                  <FieldError name="name" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required minLength={10} placeholder="At least 10 characters" />
                  <FieldError name="password" />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={10} />
                  <FieldError name="confirmPassword" />
                </div>
                <SubmitButton className="w-full" size="lg" pendingLabel="Creating account…">
                  Create account
                </SubmitButton>
              </ActionForm>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
