'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { GummyCoach } from '@/components/growth/mascot'
import { ProgressBar } from '@/components/gamification/stats'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EMPTY_TRYIT_STATE, ONBOARDING_ACTIVITY_ID, completeActivity, saveBusiness } from '@/lib/tryit/progress'
import { ONBOARDING_XP } from '@/lib/tryit/starter-content'
import { cn } from '@/lib/utils'
import { useTryIt } from './use-try-it'

const AUDIENCES = ['Young adults', 'Parents and families', 'Working professionals', 'Local shoppers', 'Other businesses', 'Not sure yet']
const GOALS = ['More sales', 'More leads and enquiries', 'More people knowing my brand', 'More visits to my shop']

type Step = { key: 'name' | 'product' | 'audience' | 'goal'; coach: (name: string) => string; label: string }

const STEPS: Step[] = [
  { key: 'name', coach: () => "Hi, I'm Gummy! Let's build your growth plan. First - what's your business called?", label: 'Business name' },
  { key: 'product', coach: (n) => `Nice to meet you, ${n}! What do you sell?`, label: 'What you sell' },
  { key: 'audience', coach: () => "Who usually buys from you? Your best guess is fine - we'll sharpen it together.", label: 'Who buys from you' },
  { key: 'goal', coach: () => 'Last one! What do you want most right now?', label: 'Your main goal' },
]

/**
 * /start - the business onboarding that opens the public try-it (Growth
 * Map node 1, "Define Your Business"). Four friendly questions, no
 * account, saved only in this browser (src/lib/tryit/progress.ts).
 */
export function TryItOnboarding() {
  const router = useRouter()
  const { state, hydrated, update } = useTryIt()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState({ name: '', product: '', audience: '', goal: '' })
  const [restarting, setRestarting] = useState(false)

  if (!hydrated) {
    return <Skeleton className="mx-auto mt-12 h-72 w-full max-w-xl rounded-3xl" />
  }

  if (state.business && !restarting) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-12 text-center">
        <GummyCoach mood="cheer" mascotClassName="h-24 w-20" animate>
          Welcome back, <strong>{state.business.name}</strong>! Your growth journey is waiting.
        </GummyCoach>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/start/learn" className={cn(buttonVariants({ size: 'lg' }), 'uppercase tracking-wide')}>
            Continue my journey <ArrowRight className="h-4 w-4" />
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setRestarting(true)
              setStep(0)
              setValues({ name: '', product: '', audience: '', goal: '' })
            }}
          >
            Start over with a new business
          </Button>
        </div>
      </div>
    )
  }

  const current = STEPS[step]!
  const value = values[current.key]
  const isLast = step === STEPS.length - 1
  const canContinue = value.trim().length > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canContinue) return
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    const business = {
      name: values.name.trim().slice(0, 80),
      product: values.product.trim().slice(0, 160),
      audience: values.audience,
      goal: values.goal,
    }
    // "Start over" wipes the old journey - a new business starts fresh.
    update((s) => completeActivity(saveBusiness(restarting ? EMPTY_TRYIT_STATE : s, business), ONBOARDING_ACTIVITY_ID, ONBOARDING_XP))
    router.push('/start/learn')
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-14">
      <ProgressBar value={step} max={STEPS.length} label="Onboarding progress" />

      <GummyCoach mood={step === 0 ? 'happy' : 'thinking'} mascotClassName="h-24 w-20" animate={step === 0} live>
        {current.coach(values.name.trim() || 'friend')}
      </GummyCoach>

      <form onSubmit={submit} className="space-y-6">
        {current.key === 'name' || current.key === 'product' ? (
          <div className="space-y-2">
            <label htmlFor="tryit-field" className="text-sm font-semibold text-foreground">
              {current.label}
            </label>
            <input
              id="tryit-field"
              key={current.key}
              autoFocus
              maxLength={current.key === 'name' ? 80 : 160}
              value={value}
              onChange={(e) => setValues((v) => ({ ...v, [current.key]: e.target.value }))}
              placeholder={current.key === 'name' ? 'e.g. GreenSip' : 'e.g. Eco-friendly water bottles'}
              className="h-14 w-full rounded-2xl border-2 border-border bg-card px-4 text-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
            />
          </div>
        ) : (
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-foreground">{current.label}</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(current.key === 'audience' ? AUDIENCES : GOALS).map((option) => {
                const selected = value === option
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setValues((v) => ({ ...v, [current.key]: option }))}
                    className={cn(
                      'rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary bg-primary-tint text-foreground' : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" disabled={!canContinue} className="min-w-40 uppercase tracking-wide">
            {isLast ? `Start my journey · +${ONBOARDING_XP} XP` : 'Continue'}
          </Button>
        </div>
      </form>
    </div>
  )
}
