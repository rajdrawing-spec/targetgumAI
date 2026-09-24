/**
 * Growth Shop catalog (docs/DECISIONS.md 2026-09-24). Zero-dependency so
 * both the server (purchase rules) and client components (rendering an
 * equipped outfit / theme / celebration) can import it.
 *
 * Rules from the product brief, enforced by what is (and isn't) listed:
 * - Only cosmetic or convenience items. Nothing here unlocks business
 *   functionality - AI insights, campaigns, analytics stay subscription /
 *   permission controlled, never XP-controlled.
 * - Every item does something real. The reference mockups' "XP
 *   Multiplier" and "Campaign Boost" are deliberately absent: one would
 *   artificially inflate XP, the other would sell AI functionality for XP.
 */

export type ShopCategory = 'boosts' | 'mascots' | 'themes' | 'rewards'
export type ShopSlot = 'mascot' | 'mapTheme' | 'celebration'

export interface ShopItem {
  key: string
  category: ShopCategory
  name: string
  description: string
  xpCost: number
  /** Consumables stack up to `maxHeld`; everything else is bought once and equipped. */
  kind: 'consumable' | 'cosmetic'
  slot?: ShopSlot
  maxHeld?: number
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    key: 'streak-shield',
    category: 'boosts',
    name: 'Streak Shield',
    description: 'Protects your streak if you miss one day. Used automatically.',
    xpCost: 300,
    kind: 'consumable',
    maxHeld: 2,
  },
  {
    key: 'gummy-shades',
    category: 'mascots',
    name: 'Cool Gummy',
    description: 'Gummy in sunglasses, everywhere Gummy appears for this client.',
    xpCost: 400,
    kind: 'cosmetic',
    slot: 'mascot',
  },
  {
    key: 'gummy-party-hat',
    category: 'mascots',
    name: 'Party Gummy',
    description: 'A party hat for Gummy - every day is launch day.',
    xpCost: 300,
    kind: 'cosmetic',
    slot: 'mascot',
  },
  {
    key: 'map-sunset',
    category: 'themes',
    name: 'Sunset Growth Map',
    description: 'A warm sunset glow behind your Growth Map.',
    xpCost: 600,
    kind: 'cosmetic',
    slot: 'mapTheme',
  },
  {
    key: 'map-ocean',
    category: 'themes',
    name: 'Ocean Growth Map',
    description: 'Cool ocean blues behind your Growth Map.',
    xpCost: 600,
    kind: 'cosmetic',
    slot: 'mapTheme',
  },
  {
    key: 'gold-confetti',
    category: 'rewards',
    name: 'Gold Celebration',
    description: 'Golden confetti when you finish a lesson.',
    xpCost: 500,
    kind: 'cosmetic',
    slot: 'celebration',
  },
]

export const SHOP_CATEGORIES: ReadonlyArray<{ key: ShopCategory; label: string }> = [
  { key: 'boosts', label: 'Boosts' },
  { key: 'mascots', label: 'Mascots' },
  { key: 'themes', label: 'Themes' },
  { key: 'rewards', label: 'Rewards' },
]

export function getShopItem(key: string | null | undefined): ShopItem | undefined {
  return key ? SHOP_ITEMS.find((i) => i.key === key) : undefined
}

/** Growth Map card background per equipped theme - semantic tokens, so it works in light and dark mode. */
export const MAP_THEME_CLASSES: Record<string, string> = {
  'map-sunset': 'bg-gradient-to-b from-warning-bg via-card to-primary-tint',
  'map-ocean': 'bg-gradient-to-b from-info-bg via-card to-success-bg',
}

export type GummyOutfit = 'shades' | 'party-hat'

export const MASCOT_OUTFITS: Record<string, GummyOutfit> = {
  'gummy-shades': 'shades',
  'gummy-party-hat': 'party-hat',
}

export interface GummyStyle {
  outfit: GummyOutfit | null
  goldCelebration: boolean
}

/**
 * Equipped cosmetics -> what Gummy wears and which lesson celebration to
 * use. Pure: each growth page derives this from the progress row it
 * already loaded. Deliberately not a query in the Client Workspace
 * layout - an extra DB call there made same-page Server Action results
 * (quest claims, purchases) intermittently never apply on the client
 * (docs/DECISIONS.md 2026-09-24).
 */
export function cosmeticsFor(progress: { equippedMascot: string | null; equippedCelebration: string | null } | null | undefined): GummyStyle {
  return {
    outfit: (progress?.equippedMascot && MASCOT_OUTFITS[progress.equippedMascot]) || null,
    goldCelebration: progress?.equippedCelebration === 'gold-confetti',
  }
}
