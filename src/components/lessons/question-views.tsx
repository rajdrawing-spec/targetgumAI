'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, User, XCircle } from 'lucide-react'
import type { BudgetQuestion, ChoiceQuestion, LessonAnswer, LessonQuestion, MatchQuestion, OrderQuestion } from '@/lib/lessons/types'
import { stableShuffle } from '@/lib/lessons/types'
import { GummyMascot } from '@/components/growth/mascot'
import { cn } from '@/lib/utils'

/**
 * One renderer per lesson-engine question type (src/lib/lessons/types.ts).
 * Each is fully keyboard-operable with real <button>/<input> controls -
 * no drag-and-drop-only interactions (the "order" question uses move
 * up/down buttons, "match" uses tap-to-pair).
 */

export interface QuestionViewProps<Q extends LessonQuestion> {
  question: Q
  answer: LessonAnswer | null
  onAnswer: (answer: LessonAnswer) => void
  /** After CHECK: inputs lock and right/wrong styling shows. */
  checked: boolean
}

export function QuestionView(props: QuestionViewProps<LessonQuestion>) {
  const { question } = props
  switch (question.type) {
    case 'choice':
      return <ChoiceView {...props} question={question} />
    case 'order':
      return <OrderView {...props} question={question} />
    case 'match':
      return <MatchView {...props} question={question} />
    case 'budget':
      return <BudgetView {...props} question={question} />
  }
}

const optionBase =
  'flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:text-base'

function ChoiceView({ question, answer, onAnswer, checked }: QuestionViewProps<ChoiceQuestion>) {
  const selected = answer?.type === 'choice' ? answer.index : null
  const cards = question.layout === 'cards'

  return (
    <div className="space-y-5">
      {question.conversation && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-start justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-primary-tint" aria-hidden="true">
              <GummyMascot mood="happy" className="mt-1 h-20 w-16" />
            </span>
            <p className="rounded-2xl border-2 border-border bg-card px-4 py-3 text-sm text-foreground sm:text-base">{question.conversation.coach}</p>
          </div>
          <div className="flex items-start justify-end gap-3">
            <p className="rounded-2xl bg-primary-tint px-4 py-3 text-sm text-foreground sm:text-base">
              {question.conversation.learner.split('___').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className={cn('mx-1 inline-block min-w-16 border-b-2 border-foreground/60 font-semibold', selected !== null && 'text-primary')}>
                      {selected !== null ? question.options[selected] : ' '}
                    </span>
                  )}
                </span>
              ))}
            </p>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background" aria-hidden="true">
              <User className="h-5 w-5" />
            </span>
          </div>
        </div>
      )}

      <div role="radiogroup" aria-label="Answer options" className={cn(cards ? 'grid gap-3 sm:grid-cols-3' : 'space-y-2.5')}>
        {question.options.map((option, i) => {
          const isSelected = selected === i
          const showCorrect = checked && i === question.correctIndex
          const showWrong = checked && isSelected && i !== question.correctIndex
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={checked}
              onClick={() => onAnswer({ type: 'choice', index: i })}
              className={cn(
                optionBase,
                cards && 'min-h-28 flex-col items-center justify-center text-center',
                !checked && isSelected && 'border-primary bg-primary-tint',
                !checked && !isSelected && 'border-border bg-card hover:border-muted-foreground/40 hover:bg-muted',
                showCorrect && 'border-success bg-success-bg',
                showWrong && 'border-destructive bg-destructive-bg',
                checked && !showCorrect && !showWrong && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold',
                  isSelected ? 'border-primary text-primary' : 'border-border text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {cards ? String.fromCharCode(65 + i) : i + 1}
              </span>
              <span className="flex-1 text-foreground">{option}</span>
              {showCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Correct answer" />}
              {showWrong && <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-label="Your answer" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OrderView({ question, answer, onAnswer, checked }: QuestionViewProps<OrderQuestion>) {
  const sequence = answer?.type === 'order' ? answer.sequence : []

  function move(position: number, delta: -1 | 1) {
    const target = position + delta
    if (target < 0 || target >= sequence.length) return
    const next = [...sequence]
    ;[next[position], next[target]] = [next[target]!, next[position]!]
    onAnswer({ type: 'order', sequence: next })
  }

  return (
    <ol className="space-y-2" aria-label="Steps - use the arrow buttons to reorder">
      {sequence.map((stepIndex, position) => {
        const right = checked && stepIndex === position
        const wrong = checked && stepIndex !== position
        return (
          <li
            key={stepIndex}
            className={cn(
              'flex items-center gap-3 rounded-2xl border-2 bg-card px-3 py-2.5 text-sm font-medium sm:text-base',
              !checked && 'border-border',
              right && 'border-success bg-success-bg',
              wrong && 'border-destructive bg-destructive-bg',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-border text-xs font-bold text-muted-foreground">
              {position + 1}
            </span>
            <span className="flex-1 text-foreground">{question.steps[stepIndex]}</span>
            {checked ? (
              wrong && <span className="shrink-0 text-xs font-semibold text-destructive">Step {stepIndex + 1}</span>
            ) : (
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(position, -1)}
                  disabled={position === 0}
                  aria-label={`Move "${question.steps[stepIndex]}" up`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(position, 1)}
                  disabled={position === sequence.length - 1}
                  aria-label={`Move "${question.steps[stepIndex]}" down`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

const PAIR_COLORS = ['bg-primary', 'bg-info', 'bg-warning', 'bg-success', 'bg-foreground', 'bg-mustard']

function MatchView({ question, answer, onAnswer, checked }: QuestionViewProps<MatchQuestion>) {
  const mapping = answer?.type === 'match' ? answer.mapping : question.pairs.map(() => -1)
  const [activeLeft, setActiveLeft] = useState<number | null>(null)
  const rightOrder = useMemo(() => stableShuffle(question.pairs.length, `${question.id}:right`), [question])

  function pickLeft(left: number) {
    if (mapping[left] !== -1) {
      // Tapping an already-paired item unpairs it.
      const next = [...mapping]
      next[left] = -1
      onAnswer({ type: 'match', mapping: next })
      setActiveLeft(left)
      return
    }
    setActiveLeft(left)
  }

  function pickRight(right: number) {
    if (activeLeft === null) return
    const next = mapping.map((r) => (r === right ? -1 : r))
    next[activeLeft] = right
    onAnswer({ type: 'match', mapping: next })
    const nextUnpaired = next.findIndex((r) => r === -1)
    setActiveLeft(nextUnpaired === -1 ? null : nextUnpaired)
  }

  const leftForRight = (right: number) => mapping.findIndex((r) => r === right)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2" role="group" aria-label="Items">
        {question.pairs.map((pair, left) => {
          const paired = mapping[left] !== -1
          const isCorrect = checked && mapping[left] === left
          return (
            <button
              key={left}
              type="button"
              disabled={checked}
              onClick={() => pickLeft(left)}
              aria-pressed={activeLeft === left}
              className={cn(
                optionBase,
                'min-h-14',
                !checked && activeLeft === left && 'border-primary bg-primary-tint',
                !checked && activeLeft !== left && 'border-border bg-card hover:bg-muted',
                checked && (isCorrect ? 'border-success bg-success-bg' : 'border-destructive bg-destructive-bg'),
              )}
            >
              {paired && <span className={cn('h-3 w-3 shrink-0 rounded-full', PAIR_COLORS[left % PAIR_COLORS.length])} aria-hidden="true" />}
              <span className="flex-1 font-semibold text-foreground">{pair.left}</span>
            </button>
          )
        })}
      </div>
      <div className="space-y-2" role="group" aria-label="Matches">
        {rightOrder.map((right) => {
          const left = leftForRight(right)
          return (
            <button
              key={right}
              type="button"
              disabled={checked || activeLeft === null}
              onClick={() => pickRight(right)}
              aria-label={`${question.pairs[right]!.right}${left !== -1 ? ` - paired with ${question.pairs[left]!.left}` : ''}`}
              className={cn(
                optionBase,
                'min-h-14 text-xs sm:text-sm',
                left !== -1 ? 'border-foreground/20 bg-muted' : 'border-border bg-card hover:bg-muted',
                'disabled:opacity-100',
              )}
            >
              {left !== -1 && <span className={cn('h-3 w-3 shrink-0 rounded-full', PAIR_COLORS[left % PAIR_COLORS.length])} aria-hidden="true" />}
              <span className="flex-1 text-foreground">{question.pairs[right]!.right}</span>
            </button>
          )
        })}
      </div>
      {!checked && (
        <p className="col-span-2 text-xs text-muted-foreground" aria-live="polite">
          {activeLeft !== null ? `Now pick the match for "${question.pairs[activeLeft]!.left}".` : 'Tap an item on the left, then its match on the right.'}
        </p>
      )}
    </div>
  )
}

function BudgetView({ question, answer, onAnswer, checked }: QuestionViewProps<BudgetQuestion>) {
  const amounts = answer?.type === 'budget' ? answer.amounts : question.channels.map(() => 0)
  const allocated = amounts.reduce((s, v) => s + v, 0)
  const remaining = question.total - allocated
  const fmt = (n: number) => `${question.currencySymbol}${n.toLocaleString()}`

  function setAmount(i: number, raw: number) {
    const others = allocated - (amounts[i] ?? 0)
    const value = Math.max(0, Math.min(raw, question.total - others))
    const next = [...amounts]
    next[i] = value
    onAnswer({ type: 'budget', amounts: next })
  }

  return (
    <div className="space-y-4">
      {question.channels.map((channel, i) => {
        const id = `${question.id}-${i}`
        const isLargestTarget = checked && i === question.largestChannelIndex
        return (
          <div key={channel} className={cn('flex items-center gap-3 rounded-2xl border-2 bg-card px-3 py-2.5', isLargestTarget ? 'border-success' : 'border-border')}>
            <label htmlFor={id} className="w-24 shrink-0 text-sm font-semibold text-foreground sm:w-32">
              {channel}
            </label>
            <input
              id={id}
              type="range"
              min={0}
              max={question.total}
              step={question.step}
              value={amounts[i] ?? 0}
              disabled={checked}
              onChange={(e) => setAmount(i, Number(e.target.value))}
              aria-valuetext={fmt(amounts[i] ?? 0)}
              className="h-2 flex-1 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-default"
            />
            <span className="w-20 shrink-0 rounded-lg border border-border px-2 py-1 text-right text-sm font-semibold tabular-nums text-foreground">
              {fmt(amounts[i] ?? 0)}
            </span>
          </div>
        )
      })}
      <p className={cn('text-sm font-semibold', remaining === 0 ? 'text-success' : 'text-muted-foreground')} aria-live="polite">
        {remaining === 0 ? `All ${fmt(question.total)} allocated.` : `${fmt(remaining)} left to allocate.`}
      </p>
    </div>
  )
}
