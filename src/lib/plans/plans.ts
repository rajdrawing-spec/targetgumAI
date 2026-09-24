/**
 * TargetGum plan tiers (docs/DECISIONS.md 2026-09-24, "Plan config, no
 * checkout yet"). The single source of truth for what the paywall and
 * upgrade surfaces say each plan includes - UI code reads this, never
 * hardcodes plan copy or prices.
 *
 * Deliberately no prices: no payment provider is chosen yet, so "Unlock
 * TargetGum" leads to an access request / invite sign-in rather than a
 * checkout. When pricing is decided, add it here (or load it from the
 * payment provider) - not in components.
 *
 * Subscription is independent of XP: nothing here can be bought with XP,
 * and XP never unlocks a plan feature.
 */

export type PlanKey = 'FREE' | 'PRO' | 'BUSINESS'

export interface PlanDef {
  key: PlanKey
  name: string
  tagline: string
  features: readonly string[]
  highlighted?: boolean
}

export const PLANS: readonly PlanDef[] = [
  {
    key: 'FREE',
    name: 'Starter',
    tagline: 'Try TargetGum - no account needed.',
    features: ['Starter Growth Journey (4 stages)', 'Beginner marketing lessons', 'Gummy, your marketing coach', 'XP and streaks, saved in this browser'],
  },
  {
    key: 'PRO',
    name: 'Pro',
    tagline: 'For a business ready to run real campaigns.',
    highlighted: true,
    features: [
      'The full 10-stage Growth Map',
      'AI marketing insights and recommendations',
      'Audience intelligence and market research',
      'AI creative generation',
      'Guided campaign builder with approvals',
      'Campaign analytics and optimization',
    ],
  },
  {
    key: 'BUSINESS',
    name: 'Business',
    tagline: 'For teams and agencies managing several brands.',
    features: ['Everything in Pro', 'Multiple clients and team members', 'Automation and weekly AI intelligence', 'Client portal and reports', 'Full audit trail and roles'],
  },
]

/**
 * Where "Unlock TargetGum" sends a visitor. `ACCESS_REQUEST_URL` (server
 * env, optional) may be an https:// form or a mailto: link; anything
 * else is ignored rather than rendered as a link. Unset -> null, and the
 * page offers only "Sign in with your invite" - never a button that
 * can't work (docs/SECURITY.md).
 */
export function accessRequestUrl(raw: string | undefined = process.env.ACCESS_REQUEST_URL): string | null {
  if (!raw) return null
  const value = raw.trim()
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'mailto:' ? url.toString() : null
  } catch {
    return null
  }
}
