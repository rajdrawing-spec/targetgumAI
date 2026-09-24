/**
 * The TargetGum lesson engine's question model (docs/DECISIONS.md
 * 2026-09-24, "Reusable lesson engine"). One discriminated union covers
 * every question format the Growth Map lessons and the public try-it
 * lessons use, so both surfaces render through the same `LessonPlayer`
 * and grade through the same pure `gradeAnswer` below.
 *
 * Zero-dependency and framework-free on purpose: grading must be
 * unit-testable without React, and this file is imported by both server
 * (lesson content) and client (player) code.
 *
 * Formats map onto the brief's list like this:
 * - `choice`  - multiple choice, complete the sentence / conversation
 *               (`conversation`), choose the best CTA / headline / offer,
 *               identify the mistake, pick the target audience or
 *               objective, select the best creative (`layout: 'cards'`)
 * - `order`   - arrange campaign steps in the correct order
 * - `match`   - match platform to objective, audience to product
 * - `budget`  - allocate a budget across channels
 */

interface QuestionBase {
  id: string
  /** Small red label above the heading - e.g. "Audience Targeting". */
  category: string
  prompt: string
  /** Why the correct answer is correct - always shown after checking. */
  explanation: string
  /** Optional hint shown beside the question before answering. */
  tip?: string
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice'
  options: readonly string[]
  correctIndex: number
  /**
   * Renders the question as a chat: Gummy says `coach`, the learner's
   * bubble shows `learner` with a blank to fill (complete the
   * conversation / sentence).
   */
  conversation?: { coach: string; learner: string }
  /** `cards` shows options as large tiles (best creative / headline). */
  layout?: 'list' | 'cards'
}

export interface OrderQuestion extends QuestionBase {
  type: 'order'
  /** Listed in the CORRECT order; the player shuffles them deterministically. */
  steps: readonly string[]
}

export interface MatchQuestion extends QuestionBase {
  type: 'match'
  /** Each left item's correct partner is the right item at the same index. */
  pairs: ReadonlyArray<{ left: string; right: string }>
}

export interface BudgetQuestion extends QuestionBase {
  type: 'budget'
  total: number
  /** Display prefix, e.g. "₹". Illustrative lesson money, never real spend. */
  currencySymbol: string
  step: number
  channels: readonly string[]
  /**
   * The channel that must receive the strictly-largest share for the answer
   * to be correct - but not the whole budget: with 2+ channels, some money
   * must stay elsewhere to keep learning (both lessons' explanations teach
   * exactly that, so "all-in" is graded wrong).
   */
  largestChannelIndex: number
}

export type LessonQuestion = ChoiceQuestion | OrderQuestion | MatchQuestion | BudgetQuestion

/** A learner's answer, shaped per question type. */
export type LessonAnswer =
  | { type: 'choice'; index: number }
  /** Indices into `steps`, in the order the learner arranged them. */
  | { type: 'order'; sequence: readonly number[] }
  /** `mapping[leftIndex] = rightIndex` (right index as in `pairs`). */
  | { type: 'match'; mapping: readonly number[] }
  | { type: 'budget'; amounts: readonly number[] }

/** Heading shown above the prompt, per the reference layout ("Choose the best answer"). */
export function questionHeading(q: LessonQuestion): string {
  switch (q.type) {
    case 'choice':
      if (q.conversation) return 'Complete the conversation'
      return q.layout === 'cards' ? 'Pick the best one' : 'Choose the best answer'
    case 'order':
      return 'Put the steps in order'
    case 'match':
      return 'Match each pair'
    case 'budget':
      return 'Allocate the budget'
  }
}

function isPermutation(values: readonly number[], length: number): boolean {
  if (values.length !== length) return false
  const seen = new Set<number>()
  for (const v of values) {
    if (!Number.isInteger(v) || v < 0 || v >= length || seen.has(v)) return false
    seen.add(v)
  }
  return true
}

/**
 * Whether an answer is complete enough to be checked (drives the CHECK
 * button's disabled state). A malformed answer is never ready.
 */
export function isAnswerComplete(q: LessonQuestion, a: LessonAnswer | null): boolean {
  if (!a || a.type !== q.type) return false
  switch (a.type) {
    case 'choice':
      return Number.isInteger(a.index) && a.index >= 0 && a.index < (q as ChoiceQuestion).options.length
    case 'order':
      return isPermutation(a.sequence, (q as OrderQuestion).steps.length)
    case 'match':
      return isPermutation(a.mapping, (q as MatchQuestion).pairs.length)
    case 'budget': {
      const bq = q as BudgetQuestion
      if (a.amounts.length !== bq.channels.length) return false
      if (a.amounts.some((v) => !Number.isFinite(v) || v < 0)) return false
      return a.amounts.reduce((s, v) => s + v, 0) === bq.total
    }
  }
}

/**
 * Grades one answer. Incomplete or mismatched answers are simply wrong,
 * never an exception - the player can't crash on bad state.
 */
export function gradeAnswer(q: LessonQuestion, a: LessonAnswer | null): boolean {
  if (!a || !isAnswerComplete(q, a)) return false
  switch (a.type) {
    case 'choice':
      return a.index === (q as ChoiceQuestion).correctIndex
    case 'order':
      return a.sequence.every((stepIndex, position) => stepIndex === position)
    case 'match':
      return a.mapping.every((rightIndex, leftIndex) => rightIndex === leftIndex)
    case 'budget': {
      const bq = q as BudgetQuestion
      const target = a.amounts[bq.largestChannelIndex] ?? 0
      if (bq.channels.length > 1 && target >= bq.total) return false
      return a.amounts.every((v, i) => i === bq.largestChannelIndex || v < target)
    }
  }
}

/**
 * Deterministic shuffle (seeded by the question id) so server and client
 * renders agree - a `Math.random()` shuffle would cause a hydration
 * mismatch. Guarantees the result differs from the input order when the
 * list has 2+ items, so an "order" question is never pre-solved.
 */
export function stableShuffle(length: number, seed: string): number[] {
  const order = Array.from({ length }, (_, i) => i)
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  if (length > 1 && order.every((v, i) => v === i)) order.push(order.shift()!)
  return order
}

/** Hearts per lesson attempt (reference UI shows 5). */
export const LESSON_HEARTS = 5

/**
 * The starting answer state for a question: nothing picked for choice/
 * match (`-1` = unpaired), a shuffled sequence for order, and an even-ish
 * split for budget. Never pre-solved: the shuffle never returns the
 * correct order, and the budget remainder goes to a channel other than
 * the correct "largest" one.
 */
export function initialAnswer(q: LessonQuestion): LessonAnswer | null {
  switch (q.type) {
    case 'choice':
      return null
    case 'order':
      return { type: 'order', sequence: stableShuffle(q.steps.length, q.id) }
    case 'match':
      return { type: 'match', mapping: q.pairs.map(() => -1) }
    case 'budget': {
      const n = q.channels.length
      if (n === 0) return { type: 'budget', amounts: [] }
      const base = Math.floor(q.total / n / q.step) * q.step
      const amounts = q.channels.map(() => base)
      const remainderIndex = n > 1 ? (q.largestChannelIndex + 1) % n : 0
      amounts[remainderIndex] = (amounts[remainderIndex] ?? 0) + (q.total - base * n)
      return { type: 'budget', amounts }
    }
  }
}
