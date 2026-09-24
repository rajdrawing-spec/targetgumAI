import { describe, expect, it } from 'vitest'
import {
  gradeAnswer,
  initialAnswer,
  isAnswerComplete,
  stableShuffle,
  type BudgetQuestion,
  type ChoiceQuestion,
  type LessonQuestion,
  type MatchQuestion,
  type OrderQuestion,
} from '@/lib/lessons/types'
import { getLessonForStage } from '@/lib/growth/lesson-defs'
import { GROWTH_STAGE_ORDER } from '@/lib/growth/stage-defs'
import { STAGE_BRIDGES } from '@/lib/growth/stage-bridges'
import { STARTER_LESSONS } from '@/lib/tryit/starter-content'

const choice: ChoiceQuestion = { type: 'choice', id: 'c', category: 'x', prompt: 'p', explanation: 'e', options: ['a', 'b', 'c'], correctIndex: 1 }
const order: OrderQuestion = { type: 'order', id: 'o', category: 'x', prompt: 'p', explanation: 'e', steps: ['1', '2', '3', '4'] }
const match: MatchQuestion = {
  type: 'match',
  id: 'm',
  category: 'x',
  prompt: 'p',
  explanation: 'e',
  pairs: [
    { left: 'a', right: 'A' },
    { left: 'b', right: 'B' },
    { left: 'c', right: 'C' },
  ],
}
const budget: BudgetQuestion = {
  type: 'budget',
  id: 'b',
  category: 'x',
  prompt: 'p',
  explanation: 'e',
  total: 10000,
  currencySymbol: '₹',
  step: 500,
  channels: ['IG', 'FB', 'YT'],
  largestChannelIndex: 0,
}

describe('lesson engine grading', () => {
  it('grades multiple choice', () => {
    expect(gradeAnswer(choice, { type: 'choice', index: 1 })).toBe(true)
    expect(gradeAnswer(choice, { type: 'choice', index: 0 })).toBe(false)
    expect(isAnswerComplete(choice, { type: 'choice', index: 3 })).toBe(false)
    expect(gradeAnswer(choice, null)).toBe(false)
  })

  it('grades order questions only when every step is in place', () => {
    expect(gradeAnswer(order, { type: 'order', sequence: [0, 1, 2, 3] })).toBe(true)
    expect(gradeAnswer(order, { type: 'order', sequence: [1, 0, 2, 3] })).toBe(false)
    // Not a permutation (duplicate / wrong length) is incomplete, never correct.
    expect(isAnswerComplete(order, { type: 'order', sequence: [0, 0, 2, 3] })).toBe(false)
    expect(gradeAnswer(order, { type: 'order', sequence: [0, 1, 2] })).toBe(false)
  })

  it('grades match questions and treats unpaired items as incomplete', () => {
    expect(gradeAnswer(match, { type: 'match', mapping: [0, 1, 2] })).toBe(true)
    expect(gradeAnswer(match, { type: 'match', mapping: [1, 0, 2] })).toBe(false)
    expect(isAnswerComplete(match, { type: 'match', mapping: [0, -1, 2] })).toBe(false)
  })

  it('grades budget by the strictly-largest channel and requires the full total', () => {
    expect(gradeAnswer(budget, { type: 'budget', amounts: [5000, 3000, 2000] })).toBe(true)
    expect(gradeAnswer(budget, { type: 'budget', amounts: [4000, 4000, 2000] })).toBe(false) // tie is not "largest"
    expect(gradeAnswer(budget, { type: 'budget', amounts: [2000, 5000, 3000] })).toBe(false)
    expect(gradeAnswer(budget, { type: 'budget', amounts: [10000, 0, 0] })).toBe(false) // all-in: nothing left to learn from
    expect(isAnswerComplete(budget, { type: 'budget', amounts: [5000, 3000, 1000] })).toBe(false) // doesn't sum
    expect(isAnswerComplete(budget, { type: 'budget', amounts: [11000, -500, -500] })).toBe(false)
  })

  it('rejects an answer of the wrong type', () => {
    expect(gradeAnswer(choice, { type: 'order', sequence: [0] })).toBe(false)
  })

  it('shuffles deterministically and never returns the identity order', () => {
    expect(stableShuffle(5, 'seed')).toEqual(stableShuffle(5, 'seed'))
    for (const seed of ['a', 'b', 'build-steps', 'offer-steps', 'xyz']) {
      for (const n of [2, 3, 4, 6]) {
        const s = stableShuffle(n, seed)
        expect([...s].sort()).toEqual(Array.from({ length: n }, (_, i) => i))
        expect(s.every((v, i) => v === i)).toBe(false)
      }
    }
  })
})

const allLessonQuestions: Array<[string, LessonQuestion]> = [
  ...GROWTH_STAGE_ORDER.flatMap((stage) => (getLessonForStage(stage)?.questions ?? []).map((q) => [`${stage}/${q.id}`, q] as [string, LessonQuestion])),
  ...STARTER_LESSONS.flatMap((l) => l.questions.map((q) => [`starter:${l.id}/${q.id}`, q] as [string, LessonQuestion])),
]

describe('lesson content integrity', () => {
  it('has unique question ids per surface', () => {
    const ids = allLessonQuestions.map(([key]) => key)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(allLessonQuestions)('%s is well-formed and never starts pre-solved', (_key, q) => {
    expect(q.explanation.length).toBeGreaterThan(10)
    if (q.type === 'choice') {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThan(q.options.length)
    }
    if (q.type === 'budget') {
      expect(q.largestChannelIndex).toBeLessThan(q.channels.length)
      expect(q.total % q.step).toBe(0)
    }
    // The initial state must not already be the correct answer.
    expect(gradeAnswer(q, initialAnswer(q))).toBe(false)
  })

  it('keeps every starter lesson on a free node, in order', () => {
    expect(STARTER_LESSONS.map((l) => l.node)).toEqual([2, 3, 4])
  })
})

describe('stage bridges', () => {
  it('only ever point at internal dashboard routes for the given client', () => {
    for (const stage of GROWTH_STAGE_ORDER) {
      const href = STAGE_BRIDGES[stage].href('client_123')
      expect(href.startsWith('/dashboard/')).toBe(true)
      expect(href).toContain('client_123')
    }
  })
})
