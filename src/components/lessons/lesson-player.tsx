'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CheckCircle2, Lightbulb, X, XCircle } from 'lucide-react'
import {
  LESSON_HEARTS,
  gradeAnswer,
  initialAnswer,
  isAnswerComplete,
  questionHeading,
  type LessonAnswer,
  type LessonQuestion,
} from '@/lib/lessons/types'
import { GummyCoach, GummyMascot } from '@/components/growth/mascot'
import { HeartCounter, ProgressBar } from '@/components/gamification/stats'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QuestionView } from './question-views'

export interface LessonResult {
  total: number
  correct: number
  skipped: number
}

const CORRECT_LINES = ['Great choice!', 'Nailed it!', 'Exactly right!', "That's the one!"]
const WRONG_LINES = ['Almost! Here is the idea:', 'Not quite - good try!', 'Close! Think about it this way:']

/**
 * The TargetGum lesson engine's player (docs/DECISIONS.md 2026-09-24):
 * top progress bar + hearts, category label, heading, Gummy, the
 * question, an optional tip, and a SKIP / CHECK footer that turns into
 * green/red feedback with the explanation and CONTINUE.
 *
 * Hearts: 5 per attempt, a wrong answer costs one, SKIP costs none. At
 * zero the learner gets a friendly restart screen - the lesson is always
 * completable eventually (the 2026-09-23 "no pass/fail gate" rule still
 * holds: a low score never blocks finishing).
 *
 * The player owns no persistence. `renderComplete` receives the result
 * and returns the completion UI, so the in-app Growth Map (server-action
 * XP claim) and the public try-it (browser-local progress) each decide
 * what finishing means.
 */
export function LessonPlayer({
  lessonTitle,
  questions,
  exitHref,
  renderComplete,
  className,
}: {
  className?: string
  lessonTitle: string
  questions: readonly LessonQuestion[]
  exitHref: string
  renderComplete: (result: LessonResult, restart: () => void) => ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<LessonAnswer | null>(() => (questions[0] ? initialAnswer(questions[0]) : null))
  const [checked, setChecked] = useState(false)
  const [hearts, setHearts] = useState(LESSON_HEARTS)
  const [correct, setCorrect] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [finished, setFinished] = useState(questions.length === 0)
  const [shakeKey, setShakeKey] = useState(0)

  const question = questions[index]
  const total = questions.length
  const wasCorrect = checked && question ? gradeAnswer(question, answer) : false
  const ready = question ? isAnswerComplete(question, answer) : false
  const outOfHearts = hearts <= 0

  const restart = useCallback(() => {
    setIndex(0)
    setAnswer(questions[0] ? initialAnswer(questions[0]) : null)
    setChecked(false)
    setHearts(LESSON_HEARTS)
    setCorrect(0)
    setSkipped(0)
    setFinished(questions.length === 0)
  }, [questions])

  const advance = useCallback(() => {
    const nextIndex = index + 1
    if (nextIndex >= total) {
      setFinished(true)
      return
    }
    setIndex(nextIndex)
    setAnswer(initialAnswer(questions[nextIndex]!))
    setChecked(false)
  }, [index, total, questions])

  const check = useCallback(() => {
    if (!question || !ready || checked) return
    setChecked(true)
    if (gradeAnswer(question, answer)) {
      setCorrect((c) => c + 1)
    } else {
      setHearts((h) => h - 1)
      setShakeKey((k) => k + 1)
    }
  }, [question, ready, checked, answer])

  const skip = useCallback(() => {
    if (checked) return
    setSkipped((s) => s + 1)
    advance()
  }, [checked, advance])

  // Keyboard: Enter = CHECK/CONTINUE, 1-9 = pick a multiple-choice option.
  // Ignored while focus is on a control that already handles Enter itself.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished || outOfHearts || !question) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return
      if (e.key === 'Enter') {
        e.preventDefault()
        if (checked) advance()
        else check()
      } else if (!checked && question.type === 'choice' && /^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1
        if (i < question.options.length) setAnswer({ type: 'choice', index: i })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, outOfHearts, question, checked, advance, check])

  const coachLine = useMemo(() => {
    if (!question) return ''
    if (!checked) return question.type === 'choice' && question.conversation ? 'Help me finish this conversation!' : 'You got this - take your time.'
    return wasCorrect ? CORRECT_LINES[index % CORRECT_LINES.length]! : WRONG_LINES[index % WRONG_LINES.length]!
  }, [question, checked, wasCorrect, index])

  if (finished) {
    return <>{renderComplete({ total, correct, skipped }, restart)}</>
  }

  return (
    <div className={cn('flex min-h-[70dvh] flex-col', className)}>
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pt-4 sm:gap-4">
        <Link
          href={exitHref}
          aria-label="Exit lesson"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <p className="mb-1 hidden text-xs font-semibold text-muted-foreground sm:block">
            {lessonTitle} <span className="ml-1 tabular-nums">{Math.min(index + 1, total)} / {total}</span>
          </p>
          <ProgressBar value={index + (checked ? 1 : 0)} max={total} label="Lesson progress" />
        </div>
        <HeartCounter hearts={Math.max(0, hearts)} />
      </div>

      {question && (
        <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 pb-6 pt-6 lg:grid-cols-[180px_minmax(0,1fr)_220px] lg:pt-10">
          <aside className="hidden flex-col items-center gap-3 lg:flex" aria-hidden="true">
            <GummyMascot mood={checked ? (wasCorrect ? 'celebrate' : 'oops') : 'thinking'} animate={checked && wasCorrect} className="h-40 w-32" />
            <div className="rounded-2xl bg-primary-tint px-4 py-2 text-center">
              <p className="font-display text-base font-bold text-foreground">Gummy</p>
              <p className="text-xs text-muted-foreground">Your AI Marketing Coach</p>
            </div>
          </aside>

          <section key={shakeKey} className={cn('min-w-0 space-y-5', shakeKey > 0 && checked && !wasCorrect && 'motion-safe:animate-shake')} aria-labelledby="lesson-q">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                {question.category}
              </p>
              <h1 id="lesson-q" className="mt-1 font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                {questionHeading(question)}
              </h1>
              {!(question.type === 'choice' && question.conversation) && (
                <p className="mt-2 text-base text-muted-foreground sm:text-lg">{question.prompt}</p>
              )}
              {question.type === 'choice' && question.conversation && <p className="mt-2 text-sm text-muted-foreground">{question.prompt}</p>}
            </div>

            <div className="lg:hidden">
              <GummyCoach mood={checked ? (wasCorrect ? 'celebrate' : 'oops') : 'thinking'} mascotClassName="h-12 w-10" live>
                {coachLine}
              </GummyCoach>
            </div>

            <QuestionView question={question} answer={answer} onAnswer={setAnswer} checked={checked} />
          </section>

          <aside className="order-last lg:order-none">
            {question.tip && !checked && (
              <div className="rounded-2xl border-2 border-primary/15 bg-primary-tint p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Lightbulb className="h-4 w-4 text-mustard" aria-hidden="true" /> Tip
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{question.tip}</p>
              </div>
            )}
          </aside>
        </div>
      )}

      <footer
        className={cn(
          'sticky bottom-0 border-t-2 px-4 py-4',
          !checked && 'border-border bg-background',
          checked && wasCorrect && 'border-success/30 bg-success-bg',
          checked && !wasCorrect && 'border-destructive/30 bg-destructive-bg',
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {checked && question ? (
            <div className="flex items-start gap-3" role="status" aria-live="polite">
              {wasCorrect ? (
                <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <div>
                <p className={cn('font-display text-lg font-bold', wasCorrect ? 'text-success' : 'text-destructive')}>{coachLine}</p>
                <p className="text-sm text-foreground">{question.explanation}</p>
              </div>
            </div>
          ) : (
            <button type="button" onClick={skip} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'order-last w-full uppercase tracking-wide sm:order-none sm:w-40')}>
              Skip
            </button>
          )}

          {checked ? (
            // Out of hearts: the restart panel below replaces CONTINUE, so the
            // learner still reads this question's explanation first.
            !outOfHearts && (
              <button type="button" onClick={advance} className={cn(buttonVariants({ size: 'lg' }), 'w-full shrink-0 uppercase tracking-wide sm:w-48')} autoFocus>
                {index + 1 >= total ? 'Finish' : 'Continue'}
              </button>
            )
          ) : (
            <button type="button" onClick={check} disabled={!ready} className={cn(buttonVariants({ size: 'lg' }), 'w-full uppercase tracking-wide sm:w-48')}>
              Check
            </button>
          )}
        </div>

        {checked && outOfHearts && (
          <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col items-center gap-3 rounded-2xl bg-card p-4 text-center sm:flex-row sm:text-left">
            <GummyMascot mood="oops" className="h-16 w-14 shrink-0" />
            <p className="flex-1 text-sm text-foreground">
              <span className="font-bold">Out of hearts!</span> Every mistake taught you something. Let&apos;s run this lesson again - you&apos;ll do even
              better.
            </p>
            <button type="button" onClick={restart} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')} autoFocus>
              Try again
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
