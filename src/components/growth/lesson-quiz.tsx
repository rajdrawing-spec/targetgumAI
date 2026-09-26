'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Flame, Gem, Target } from 'lucide-react'
import type { LessonDef } from '@/lib/growth/lesson-defs'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { ActionResult } from '@/lib/actions/result'
import { LessonPlayer } from '@/components/lessons/lesson-player'
import { LessonComplete } from '@/components/lessons/lesson-complete'
import { cn } from '@/lib/utils'

type CompleteStageAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>

/**
 * A Growth Map stage's lesson, played through the shared lesson engine
 * (`LessonPlayer`). Finishing shows the celebration with two ways to
 * claim the stage's XP: back to the map, or straight into the real
 * feature that applies the lesson (the "campaign bridge" - see
 * stage-bridges.ts). Both go through the same permission/tenant-checked
 * `completeStage`, so this page never mutates stage state any other way.
 */
export function LessonQuiz({
  lesson,
  clientId,
  xpReward,
  completeAction,
  alreadyCompleted,
  streakCount,
  bridge,
}: {
  lesson: LessonDef
  clientId: string
  xpReward: number
  completeAction: CompleteStageAction | null
  /** True when this stage was already completed - review mode, no claim button. */
  alreadyCompleted: boolean
  streakCount: number
  bridge: { label: string; href: string }
}) {
  // Frozen at mount: Next refreshes this route's server data as soon as the
  // claim action resolves (flipping `alreadyCompleted` to true), which would
  // otherwise swap the ActionForm out from under its own pending redirect.
  // The action redirects server-side, so the form simply stays pending
  // ("Claiming…") until the next page arrives.
  const [canClaim] = useState(() => !alreadyCompleted && Boolean(completeAction))
  const [frozenCompleteAction] = useState(() => completeAction)
  const mapHref = `/dashboard/clients/${clientId}/growth`

  return (
    <LessonPlayer
      lessonTitle={lesson.title}
      questions={lesson.questions}
      exitHref={mapHref}
      showBrand
      className="min-h-dvh"
      renderComplete={(result, restart) => (
        <LessonComplete
          summary={`You got ${result.correct} of ${result.total} right${result.skipped ? ` (${result.skipped} skipped)` : ''}. ${lesson.intro}`}
          xp={canClaim ? xpReward : null}
          stats={[
            {
              icon: <Gem className="h-5 w-5" />,
              value: canClaim ? `+${xpReward}` : '0',
              label: 'XP earned',
            },
            {
              icon: <Flame className="h-5 w-5" />,
              value: String(streakCount),
              label: 'Day streak',
            },
            {
              icon: <Target className="h-5 w-5" />,
              value: `${result.correct}/${result.total}`,
              label: 'Correct',
            },
          ]}
        >
          {canClaim && frozenCompleteAction ? (
            <ActionForm action={frozenCompleteAction} className="flex w-full flex-col gap-3">
              <div className="rounded-2xl border-2 border-primary/15 bg-primary-tint p-4 text-left">
                <p className="text-sm font-semibold text-foreground">
                  Now let&apos;s use what you learned.
                </p>
                <SubmitButton
                  name="next"
                  value="bridge"
                  size="lg"
                  className="mt-3 h-auto min-h-12 w-full whitespace-normal py-3 uppercase tracking-wide"
                  pendingLabel="Claiming…"
                >
                  Claim XP &amp; {bridge.label} <ArrowRight className="h-4 w-4" />
                </SubmitButton>
              </div>
              <SubmitButton
                name="next"
                value="map"
                variant="outline"
                size="lg"
                className="h-auto min-h-12 w-full whitespace-normal py-3"
                pendingLabel="Claiming…"
              >
                Claim XP &amp; back to the map
              </SubmitButton>
            </ActionForm>
          ) : (
            <>
              <Link
                href={bridge.href}
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-auto min-h-12 w-full whitespace-normal py-3 uppercase tracking-wide',
                )}
              >
                {bridge.label} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={mapHref}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}
              >
                Back to the Growth Map
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={restart}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Review the lesson again
          </button>
        </LessonComplete>
      )}
    />
  )
}
