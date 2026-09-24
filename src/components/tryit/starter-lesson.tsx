'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Flame, Gem, Target } from 'lucide-react'
import { getStarterLesson, STARTER_LESSONS } from '@/lib/tryit/starter-content'
import { ONBOARDING_ACTIVITY_ID, completeActivity } from '@/lib/tryit/progress'
import { LessonPlayer, type LessonResult } from '@/components/lessons/lesson-player'
import { LessonComplete } from '@/components/lessons/lesson-complete'
import { GummyCoach } from '@/components/growth/mascot'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTryIt } from './use-try-it'

/** A public try-it lesson (/start/lesson/[id]) - played through the shared lesson engine, progress saved in this browser. */
export function StarterLesson({ lessonId }: { lessonId: string }) {
  const { state, hydrated } = useTryIt()
  const lesson = getStarterLesson(lessonId)
  if (!lesson) return null

  if (!hydrated) return <Skeleton className="mx-auto mt-10 h-96 w-full max-w-3xl rounded-3xl" />

  // Stages unlock in order, like the in-app Growth Map.
  const prerequisites = [ONBOARDING_ACTIVITY_ID, ...STARTER_LESSONS.filter((l) => l.node < lesson.node).map((l) => l.id)]
  const missing = prerequisites.find((id) => !state.completed.includes(id))
  if (missing) {
    const href = missing === ONBOARDING_ACTIVITY_ID ? '/start' : `/start/lesson/${missing}`
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 py-14 text-center">
        <GummyCoach mood="thinking" mascotClassName="h-20 w-16">
          This stage unlocks after the one before it. Let&apos;s do that first!
        </GummyCoach>
        <Link href={href} className={buttonVariants({ size: 'lg' })}>
          Go to the next open stage <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const nextLesson = STARTER_LESSONS.find((l) => l.node === lesson.node + 1)

  return (
    <LessonPlayer
      lessonTitle={lesson.title}
      questions={lesson.questions}
      exitHref="/start/learn"
      className="min-h-[calc(100dvh-4rem)]"
      renderComplete={(result, restart) => <StarterComplete lessonId={lesson.id} result={result} restart={restart} nextLessonId={nextLesson?.id} />}
    />
  )
}

function StarterComplete({
  lessonId,
  result,
  restart,
  nextLessonId,
}: {
  lessonId: string
  result: LessonResult
  restart: () => void
  nextLessonId: string | undefined
}) {
  const lesson = getStarterLesson(lessonId)!
  const { state, update } = useTryIt()
  // Decided once, at the moment the lesson finished: replaying a completed
  // lesson is review mode and earns nothing (completeActivity is idempotent too).
  const [isFirstCompletion] = useState(() => !state.completed.includes(lessonId))
  const recorded = useRef(false)

  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    update((s) => completeActivity(s, lessonId, lesson.xp))
  }, [update, lessonId, lesson.xp])

  return (
    <LessonComplete
      summary={lesson.summary}
      xp={isFirstCompletion ? lesson.xp : null}
      stats={[
        { icon: <Gem className="h-5 w-5" />, value: String(state.xp), label: 'Total XP' },
        { icon: <Flame className="h-5 w-5" />, value: String(state.streak), label: 'Day streak' },
        { icon: <Target className="h-5 w-5" />, value: `${result.correct}/${result.total}`, label: 'Correct' },
      ]}
    >
      {nextLessonId ? (
        <Link href={`/start/lesson/${nextLessonId}`} className={cn(buttonVariants({ size: 'lg' }), 'w-full uppercase tracking-wide')}>
          Next lesson <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <div className="rounded-2xl border-2 border-primary/15 bg-primary-tint p-4 text-left">
          <p className="text-sm font-semibold text-foreground">Now let&apos;s use what you learned.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Turn your audience, offer and budget plan into a real campaign.</p>
          <Link href="/start/unlock" className={cn(buttonVariants({ size: 'lg' }), 'mt-3 w-full uppercase tracking-wide')}>
            Build my campaign <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={restart} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Review
        </button>
        <Link href="/start/learn" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Growth Map
        </Link>
      </div>
    </LessonComplete>
  )
}
