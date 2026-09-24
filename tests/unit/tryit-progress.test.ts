import { describe, expect, it } from 'vitest'
import { EMPTY_TRYIT_STATE, completeActivity, parseTryItState, saveBusiness } from '@/lib/tryit/progress'
import { accessRequestUrl, PLANS } from '@/lib/plans/plans'

const day = (n: number) => new Date(n * 86_400_000 + 3_600_000)

describe('try-it progress (browser-local)', () => {
  it('falls back to a fresh state for missing, corrupt or tampered data', () => {
    expect(parseTryItState(null)).toEqual(EMPTY_TRYIT_STATE)
    expect(parseTryItState('{not json')).toEqual(EMPTY_TRYIT_STATE)
    expect(parseTryItState(JSON.stringify({ v: 2 }))).toEqual(EMPTY_TRYIT_STATE)
    expect(parseTryItState(JSON.stringify({ ...EMPTY_TRYIT_STATE, xp: -5 }))).toEqual(EMPTY_TRYIT_STATE)
    expect(parseTryItState(JSON.stringify({ ...EMPTY_TRYIT_STATE, xp: 1e12 }))).toEqual(EMPTY_TRYIT_STATE)
  })

  it('round-trips a valid state', () => {
    const s = completeActivity(EMPTY_TRYIT_STATE, 'onboarding', 25, day(100))
    expect(parseTryItState(JSON.stringify(s))).toEqual(s)
  })

  it('awards XP only once per activity (replay = review, no farming)', () => {
    const once = completeActivity(EMPTY_TRYIT_STATE, 'lesson-a', 50, day(100))
    const twice = completeActivity(once, 'lesson-a', 50, day(101))
    expect(once.xp).toBe(50)
    expect(twice).toBe(once)
  })

  it('tracks the streak by UTC day: same day keeps, next day +1, gap resets', () => {
    let s = completeActivity(EMPTY_TRYIT_STATE, 'a', 10, day(100))
    expect(s.streak).toBe(1)
    s = completeActivity(s, 'b', 10, day(100))
    expect(s.streak).toBe(1)
    s = completeActivity(s, 'c', 10, day(101))
    expect(s.streak).toBe(2)
    s = completeActivity(s, 'd', 10, day(105))
    expect(s.streak).toBe(1)
  })

  it('validates business details on save', () => {
    expect(() => saveBusiness(EMPTY_TRYIT_STATE, { name: '', product: 'x', audience: '', goal: '' })).toThrow()
    const s = saveBusiness(EMPTY_TRYIT_STATE, { name: ' GreenSip ', product: 'Bottles', audience: 'Young adults', goal: 'More sales' })
    expect(s.business?.name).toBe('GreenSip')
  })
})

describe('plans config', () => {
  it('never lets XP buy a plan and keeps prices out of the frontend config', () => {
    for (const plan of PLANS) {
      expect(JSON.stringify(plan)).not.toMatch(/₹|\$|price|xp cost/i)
    }
  })

  it('only accepts https: or mailto: access-request links', () => {
    expect(accessRequestUrl(undefined)).toBeNull()
    expect(accessRequestUrl('')).toBeNull()
    expect(accessRequestUrl('javascript:alert(1)')).toBeNull()
    expect(accessRequestUrl('http://example.com/form')).toBeNull()
    expect(accessRequestUrl('not a url')).toBeNull()
    expect(accessRequestUrl('https://example.com/form')).toBe('https://example.com/form')
    expect(accessRequestUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com')
  })
})
