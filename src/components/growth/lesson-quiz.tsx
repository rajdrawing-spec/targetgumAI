'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, PartyPopper, XCircle } from 'lucide-react'
import type { LessonDef } from '@/lib/growth/lesson-defs'
import { Card, CardContent } from '@/components/ui/card'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { ActionResult } from '@/lib/actions/result'
import { GummyMascot } from './mascot'
import { cn } from '@/lib/utils'

type CompleteStageAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>

/**
 * The Duolingo-style lesson mechanic: one question at a time, an answer
 * must be checked before moving on, right/wrong is shown immediately with
 * an explanation, then a summary screen claims the stage's XP. Always
 * completable - a low score doesn't block finishing (this is
 * self-directed onboarding, not a graded exam).
 */
export function LessonQuiz({
  lesson,
  clientId,
  xpReward,
  completeAction,
  alreadyCompleted,
}: {
  lesson: LessonDef
  clientId: string
  xpReward: number
  completeAction: CompleteStageAction | null
  /** True when this stage was already completed - review mode, no claim button. */
  alreadyCompleted: boolean
}) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [claimed, setClaimed] = useState(false)

  // Frozen at mount: once we're showing the claim button, keep showing it even
  // if the parent Server Component re-renders with fresh data mid-flight (Next
  // refreshes the current route's data as soon as the server action resolves,
  // which flips `alreadyCompleted` to true - without freezing this, that
  // refresh would swap the ActionForm out from under its own pending redirect).
  const [canClaim] = useState(() => !alreadyCompleted && Boolean(completeAction))
  const [frozenCompleteAction] = useState(() => completeAction)

  const question = lesson.questions[questionIndex]
  const isLast = questionIndex === lesson.questions.length - 1
  const total = lesson.questions.length

  if (finished || !question) {
    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0
    return (
      <Card className="mx-auto max-w-xl overflow-hidden">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <GummyMascot animate className="h-24 w-20" />
          <div className="flex items-center gap-2 text-primary">
            <PartyPopper className="h-5 w-5" />
            <h2 className="font-display text-xl font-bold text-foreground">Lesson complete!</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            You got <span className="font-semibold text-foreground">{correctCount}</span> of{' '}
            <span className="font-semibold text-foreground">{total}</span> right ({scorePct}%).
          </p>

          {canClaim && frozenCompleteAction ? (
            <>
              <div className="flex items-center gap-1.5 rounded-full bg-primary-tint px-4 py-1.5 text-sm font-semibold text-primary">+{xpReward} XP</div>
              {claimed ? (
                <p className="text-sm font-medium text-success">Nice! Taking you back to the map…</p>
              ) : (
                <ActionForm action={frozenCompleteAction} className="w-full" onSuccess={() => setClaimed(true)}>
                  <SubmitButton className="w-full" size="lg" pendingLabel="Claiming…">
                    Claim XP &amp; complete stage
                  </SubmitButton>
                </ActionForm>
              )}
              <button
                type="button"
                disabled={claimed}
                onClick={() => {
                  setQuestionIndex(0)
                  setSelected(null)
                  setAnswered(false)
                  setCorrectCount(0)
                  setFinished(false)
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Review the lesson again
              </button>
            </>
          ) : (
            <Link href={`/dashboard/clients/${clientId}/growth`} className={buttonVariants({ size: 'lg' })}>
              Back to the Growth Map
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  const isCorrect = selected === question.correctIndex

  function handleCheck() {
    if (selected === null) return
    setAnswered(true)
    if (selected === question!.correctIndex) setCorrectCount((c) => c + 1)
  }

  function handleContinue() {
    if (isLast) {
      setFinished(true)
      return
    }
    setQuestionIndex((i) => i + 1)
    setSelected(null)
    setAnswered(false)
  }

  return (
    <Card className="mx-auto max-w-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <div className="flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${((questionIndex + (answered ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {questionIndex + 1} / {total}
        </span>
      </div>

      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <GummyMascot className="h-14 w-12 shrink-0" />
          <p className="pt-1 text-base font-semibold leading-snug text-foreground">{question.prompt}</p>
        </div>

        <div className="space-y-2.5">
          {question.options.map((option, i) => {
            const isSelected = selected === i
            const showCorrect = answered && i === question.correctIndex
            const showWrong = answered && isSelected && i !== question.correctIndex
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => setSelected(i)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-default',
                  !answered && isSelected && 'border-primary bg-primary-tint text-primary',
                  !answered && !isSelected && 'border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted',
                  showCorrect && 'border-success bg-success-bg text-success',
                  showWrong && 'border-destructive bg-destructive-bg text-destructive',
                  answered && !isSelected && i !== question.correctIndex && 'opacity-60',
                )}
              >
                <span>{option}</span>
                {showCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {showWrong && <XCircle className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className={cn('rounded-xl border p-3.5 text-sm', isCorrect ? 'border-success/30 bg-success-bg text-success' : 'border-warning/30 bg-warning-bg text-warning')}>
            <p className="font-semibold">{isCorrect ? 'Correct!' : 'Not quite.'}</p>
            <p className="mt-0.5 text-foreground">{question.explanation}</p>
          </div>
        )}

        {answered ? (
          <button type="button" onClick={handleContinue} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
            {isLast ? 'See results' : 'Continue'}
          </button>
        ) : (
          <button type="button" onClick={handleCheck} disabled={selected === null} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
            Check
          </button>
        )}
      </CardContent>
    </Card>
  )
}
