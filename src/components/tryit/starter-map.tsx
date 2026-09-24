'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Crown, Lock, Pencil, Target, Trophy } from 'lucide-react'
import { GROWTH_STAGE_DEFS } from '@/lib/growth/stage-defs'
import { LAST_FREE_NODE, ONBOARDING_XP, STARTER_LESSONS } from '@/lib/tryit/starter-content'
import { ONBOARDING_ACTIVITY_ID } from '@/lib/tryit/progress'
import { GummyCoach, GummyMascot } from '@/components/growth/mascot'
import { ProgressBar, StreakBadge, XpBadge } from '@/components/gamification/stats'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTryIt } from './use-try-it'

type NodeStatus = 'done' | 'current' | 'locked' | 'pro'

// Zig-zag offsets (px) for the path at sm+; halved on phones (see MapNode's
// translate classes) so a node plus its label never overflows a 320px screen.
const OFFSETS = [0, 56, 80, 56, 0, -56, -80, -56, 0, 56]

/**
 * The public try-it's Growth Map (/start/learn): the same 10 stages as
 * the in-app map (GROWTH_STAGE_DEFS), with the first four playable for
 * free and the rest leading to "Unlock TargetGum". Every playable node is
 * a real activity (onboarding or a lesson) - nothing is decorative.
 */
export function StarterMap() {
  const { state, hydrated } = useTryIt()

  if (!hydrated) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[36rem] rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    )
  }

  const done = new Set(state.completed)
  const activityForNode = (node: number) =>
    node === 1 ? ONBOARDING_ACTIVITY_ID : STARTER_LESSONS.find((l) => l.node === node)?.id
  const hrefForNode = (node: number) =>
    node === 1 ? '/start' : `/start/lesson/${activityForNode(node)}`
  const xpForNode = (node: number) =>
    node === 1 ? ONBOARDING_XP : (STARTER_LESSONS.find((l) => l.node === node)?.xp ?? 0)

  let currentAssigned = false
  const nodes = GROWTH_STAGE_DEFS.map((def) => {
    let status: NodeStatus
    if (def.order > LAST_FREE_NODE) status = 'pro'
    else if (done.has(activityForNode(def.order) ?? '')) status = 'done'
    else if (!currentAssigned) {
      status = 'current'
      currentAssigned = true
    } else status = 'locked'
    return { ...def, status }
  })
  const freeDone = nodes.filter((n) => n.status === 'done').length
  const starterComplete = freeDone >= LAST_FREE_NODE
  const current = nodes.find((n) => n.status === 'current')

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section
        aria-labelledby="journey-title"
        className="rounded-3xl border-2 border-border bg-card px-4 py-8 sm:px-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              id="journey-title"
              className="font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl"
            >
              Marketing Growth Journey
            </h1>
            <p className="mt-1 text-muted-foreground">
              Learn marketing. Apply it. Grow your business.
            </p>
          </div>
          <GummyCoach
            mood={starterComplete ? 'celebrate' : 'cheer'}
            mascotClassName="h-16 w-14"
            tone="tint"
            className="hidden sm:flex"
          >
            {starterComplete ? 'Starter journey complete!' : "Let's grow together!"}
          </GummyCoach>
        </div>

        <ol className="mt-10 flex flex-col items-center gap-3" aria-label="Growth Map stages">
          {nodes.map((node, i) => (
            <li key={node.key} className="flex w-full flex-col items-center">
              <div
                className="translate-x-[calc(var(--path-x)*0.35px)] sm:translate-x-[calc(var(--path-x)*1px)]"
                style={{ '--path-x': OFFSETS[i] ?? 0 } as CSSProperties}
              >
                <MapNode
                  order={node.order}
                  title={node.title}
                  description={node.description}
                  status={node.status}
                  href={node.status === 'pro' ? '/start/unlock' : hrefForNode(node.order)}
                  xp={xpForNode(node.order)}
                />
              </div>
            </li>
          ))}
          <li className="mt-4 flex flex-col items-center gap-2 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-mustard/40 bg-warning-bg text-mustard">
              <Trophy className="h-9 w-9" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
              Growth Master
            </span>
          </li>
        </ol>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border-2 border-border bg-card p-5">
          <p className="text-sm font-semibold text-muted-foreground">Your progress</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <XpBadge xp={state.xp} />
            {state.streak > 0 && <StreakBadge days={state.streak} />}
          </div>
          <ProgressBar
            className="mt-4"
            value={freeDone}
            max={GROWTH_STAGE_DEFS.length}
            label="Growth Map progress"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {freeDone} of {GROWTH_STAGE_DEFS.length} stages complete
          </p>
          {current && (
            <Link
              href={hrefForNode(current.order)}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 h-auto min-h-12 w-full whitespace-normal py-3 text-center uppercase tracking-wide')}
            >
              {current.order === 1 ? 'Start' : 'Continue'}: {current.title}{' '}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {starterComplete && (
          <div className="rounded-3xl border-2 border-primary/20 bg-primary-tint p-5 motion-safe:animate-fade-in-up">
            <GummyMascot mood="celebrate" animate className="mx-auto h-24 w-20" />
            <p className="mt-2 text-center font-display text-xl font-extrabold text-foreground">
              You&apos;ve completed your starter growth journey.
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              You&apos;re ready for the next level: real campaigns, AI insights and the full Growth
              Map.
            </p>
            <Link
              href="/start/unlock"
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 w-full uppercase tracking-wide')}
            >
              <Crown className="h-4 w-4" /> Unlock TargetGum
            </Link>
          </div>
        )}

        {state.business ? (
          <div className="rounded-3xl border-2 border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Your business</p>
              <Link
                href="/start"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Pencil className="h-3 w-3" /> Change
              </Link>
            </div>
            <p className="mt-1 font-display text-lg font-bold text-foreground">
              {state.business.name}
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Sells:</dt>
                <dd className="text-foreground">{state.business.product}</dd>
              </div>
              {state.business.audience && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Buyers:</dt>
                  <dd className="text-foreground">{state.business.audience}</dd>
                </div>
              )}
              {state.business.goal && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Goal:</dt>
                  <dd className="text-foreground">{state.business.goal}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-border bg-card p-5">
            <GummyCoach mood="happy" mascotClassName="h-14 w-12">
              Let&apos;s start with your business - it takes a minute.
            </GummyCoach>
            <Link href="/start" className={cn(buttonVariants({ size: 'lg' }), 'mt-3 w-full')}>
              Tell Gummy about your business
            </Link>
          </div>
        )}

        <p className="px-2 text-xs text-muted-foreground">
          Your starter progress is saved in this browser only. No account needed.
        </p>
      </aside>
    </div>
  )
}

function MapNode({
  order,
  title,
  description,
  status,
  href,
  xp,
}: {
  order: number
  title: string
  description: string
  status: NodeStatus
  href: string
  xp: number
}) {
  const circle = cn(
    'flex h-20 w-20 items-center justify-center rounded-full border-b-[6px] transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
    status === 'done' && 'border-primary-hover bg-primary text-primary-foreground hover:scale-105',
    status === 'current' &&
      'border-primary-hover bg-primary text-primary-foreground hover:scale-105 motion-safe:animate-glow-pulse',
    (status === 'locked' || status === 'pro') && 'border-border bg-muted text-muted-foreground',
    status === 'pro' && 'hover:scale-105',
  )
  const icon =
    status === 'done' ? (
      <Check className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
    ) : status === 'current' ? (
      <Target className="h-9 w-9" aria-hidden="true" />
    ) : (
      <Lock className="h-7 w-7" aria-hidden="true" />
    )
  const statusText =
    status === 'done'
      ? 'completed'
      : status === 'current'
        ? 'up next'
        : status === 'pro'
          ? 'part of the full TargetGum'
          : 'locked'

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        {status === 'current' && (
          <GummyMascot
            mood="happy"
            animate
            className="absolute -left-20 top-0 hidden h-20 w-16 sm:block"
          />
        )}
        {status === 'locked' ? (
          <span
            className={circle}
            aria-label={`Stage ${order}: ${title} - ${statusText}`}
            role="img"
          >
            {icon}
          </span>
        ) : (
          <Link
            href={href}
            className={circle}
            aria-label={`Stage ${order}: ${title} - ${statusText}`}
          >
            {icon}
          </Link>
        )}
        {status === 'pro' && (
          <span className="absolute -right-2 -top-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase text-background">
            Pro
          </span>
        )}
      </div>
      <p
        className={cn(
          'mt-2 max-w-40 font-display sm:max-w-48 text-sm font-bold leading-tight',
          status === 'locked' || status === 'pro' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {order}. {title}
      </p>
      {status === 'current' ? (
        <p className="max-w-44 text-xs text-muted-foreground sm:max-w-52">
          {description} <span className="font-semibold text-primary">+{xp} XP</span>
        </p>
      ) : status === 'done' ? (
        <p className="text-xs font-semibold text-success">+{xp} XP earned</p>
      ) : null}
    </div>
  )
}
