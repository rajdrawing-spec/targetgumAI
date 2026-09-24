import Link from 'next/link'
import { Check, Crown, LogIn } from 'lucide-react'
import { PLANS, accessRequestUrl } from '@/lib/plans/plans'
import { GummyCoach } from '@/components/growth/mascot'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Reads ACCESS_REQUEST_URL at request time, so a Hostinger/Vercel env change needs no rebuild.
export const dynamic = 'force-dynamic'

/**
 * The free -> paid moment (docs/DECISIONS.md 2026-09-24). Plans come from
 * src/lib/plans/plans.ts, never hardcoded here. There is no checkout yet:
 * "Unlock TargetGum" requests access (ACCESS_REQUEST_URL) and existing
 * invitees sign in - accounts are still created only by invitation.
 * "Continue free" always stays available; the free journey is never
 * blocked by this page.
 */
export default function UnlockPage() {
  const requestUrl = accessRequestUrl()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <GummyCoach mood="celebrate" animate mascotClassName="h-24 w-20" tone="tint">
          You&apos;re ready for the next level!
        </GummyCoach>
        <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">Unlock the full TargetGum</h1>
        <p className="mt-2 text-muted-foreground">
          Keep your growth going with real campaigns, AI marketing insights, creative generation and the complete Growth Map.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Plans">
        {PLANS.map((plan) => (
          <li
            key={plan.key}
            className={cn('flex flex-col rounded-3xl border-2 bg-card p-6', plan.highlighted ? 'border-primary shadow-glow' : 'border-border')}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold text-foreground">{plan.name}</h2>
              {plan.key === 'FREE' && <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-bold text-success">Current</span>}
              {plan.highlighted && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Most popular</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.key === 'FREE' ? (
              <Link href="/start/learn" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-6 w-full')}>
                Continue free
              </Link>
            ) : requestUrl ? (
              <a
                href={requestUrl}
                target={requestUrl.startsWith('https:') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: plan.highlighted ? 'primary' : 'outline', size: 'lg' }), 'mt-6 w-full uppercase tracking-wide')}
              >
                <Crown className="h-4 w-4" aria-hidden="true" /> Unlock TargetGum
              </a>
            ) : (
              <Link href="/sign-in" className={cn(buttonVariants({ variant: plan.highlighted ? 'primary' : 'outline', size: 'lg' }), 'mt-6 w-full')}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in with your invite
              </Link>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an invite?{' '}
        <Link href="/sign-in" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
        . Access is by invitation while we onboard businesses personally.
      </p>
    </div>
  )
}
