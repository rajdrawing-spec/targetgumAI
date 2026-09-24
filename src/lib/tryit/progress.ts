import { z } from 'zod'

/**
 * Browser-local progress for the public try-it (docs/DECISIONS.md
 * 2026-09-24). Lives only in the visitor's localStorage - never sent to
 * the server, never touches the database - which is what keeps the try-it
 * outside the invite-only auth model. Pure functions only; the React
 * binding is `useTryIt` (src/components/tryit/use-try-it.ts).
 *
 * Everything read back is validated: localStorage is user-editable, so a
 * malformed or tampered value falls back to a fresh state instead of
 * crashing the page. (Tampering can only change what this visitor sees
 * in their own browser - nothing here grants access to anything.)
 */

export const TRYIT_STORAGE_KEY = 'tg-tryit-v1'

const BusinessSchema = z.object({
  name: z.string().trim().min(1).max(80),
  product: z.string().trim().min(1).max(160),
  audience: z.string().trim().max(80),
  goal: z.string().trim().max(80),
})

const StateSchema = z.object({
  v: z.literal(1),
  business: BusinessSchema.nullable(),
  completed: z.array(z.string().max(64)).max(50),
  xp: z.number().int().min(0).max(100_000),
  streak: z.number().int().min(0).max(10_000),
  /** UTC day number (ms / 86_400_000) of the last activity. */
  lastActiveDay: z.number().int().nullable(),
})

export type TryItBusiness = z.infer<typeof BusinessSchema>
export type TryItState = z.infer<typeof StateSchema>

export const EMPTY_TRYIT_STATE: TryItState = { v: 1, business: null, completed: [], xp: 0, streak: 0, lastActiveDay: null }

export function parseTryItState(raw: string | null | undefined): TryItState {
  if (!raw) return EMPTY_TRYIT_STATE
  try {
    const parsed = StateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY_TRYIT_STATE
  } catch {
    return EMPTY_TRYIT_STATE
  }
}

const dayNumber = (now: Date) => Math.floor(now.getTime() / 86_400_000)

/** Same rule as the in-app Growth Map (src/lib/growth/progress.ts): same UTC day keeps, next day +1, gap resets to 1. */
function nextStreak(state: TryItState, now: Date): Pick<TryItState, 'streak' | 'lastActiveDay'> {
  const today = dayNumber(now)
  if (state.lastActiveDay === null) return { streak: 1, lastActiveDay: today }
  const diff = today - state.lastActiveDay
  if (diff <= 0) return { streak: Math.max(1, state.streak), lastActiveDay: state.lastActiveDay }
  if (diff === 1) return { streak: state.streak + 1, lastActiveDay: today }
  return { streak: 1, lastActiveDay: today }
}

/**
 * Marks an activity (onboarding or a lesson) complete. Idempotent: XP is
 * awarded only the first time a given id completes, so replaying a lesson
 * for review never inflates the number.
 */
export function completeActivity(state: TryItState, activityId: string, xp: number, now: Date = new Date()): TryItState {
  if (state.completed.includes(activityId)) return state
  return {
    ...state,
    ...nextStreak(state, now),
    completed: [...state.completed, activityId],
    xp: state.xp + Math.max(0, Math.floor(xp)),
  }
}

export function saveBusiness(state: TryItState, business: TryItBusiness): TryItState {
  return { ...state, business: BusinessSchema.parse(business) }
}

export const ONBOARDING_ACTIVITY_ID = 'onboarding'
