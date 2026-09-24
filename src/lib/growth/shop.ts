import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { getShopItem, SHOP_ITEMS, type ShopSlot } from './shop-catalog'

/**
 * Growth Shop (docs/DECISIONS.md 2026-09-24). Spending XP lowers the
 * spendable balance (`xp - xpSpent`) only - total XP and level never go
 * down. Purchases are an append-only ledger (`ClientGrowthPurchase`) plus
 * a compare-and-set on `xpSpent`, so two concurrent purchases can never
 * spend the same XP twice.
 */

const SLOT_COLUMN = {
  mascot: 'equippedMascot',
  mapTheme: 'equippedMapTheme',
  celebration: 'equippedCelebration',
} as const satisfies Record<ShopSlot, string>

export async function getShopState(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const [progress, purchases] = await Promise.all([
    db.clientGrowthProgress.findUnique({ where: { clientId: client.id } }),
    db.clientGrowthPurchase.findMany({ where: { clientId: client.id }, select: { itemKey: true } }),
  ])
  return {
    xp: progress?.xp ?? 0,
    balance: (progress?.xp ?? 0) - (progress?.xpSpent ?? 0),
    streakCount: progress?.streakCount ?? 0,
    streakShields: progress?.streakShields ?? 0,
    owned: new Set(purchases.map((p) => p.itemKey)),
    equipped: {
      mascot: progress?.equippedMascot ?? null,
      mapTheme: progress?.equippedMapTheme ?? null,
      celebration: progress?.equippedCelebration ?? null,
    } satisfies Record<ShopSlot, string | null>,
  }
}

export async function purchaseShopItem(ctx: AuthContext, clientId: string, itemKey: string) {
  assertPermission(ctx, 'growth.write')
  const client = await getAuthorizedClient(ctx, clientId)
  const item = getShopItem(itemKey)
  if (!item) throw new Error('That item isn’t in the shop.')

  await db.$transaction(async (tx) => {
    const progress = await tx.clientGrowthProgress.findUnique({ where: { clientId: client.id } })
    if (!progress) throw new Error('Earn some XP on the Growth Map first.')
    const balance = progress.xp - progress.xpSpent
    if (balance < item.xpCost) throw new Error(`You need ${item.xpCost - balance} more XP for ${item.name}.`)

    if (item.kind === 'consumable') {
      if (progress.streakShields >= (item.maxHeld ?? 1)) throw new Error(`You can hold at most ${item.maxHeld} ${item.name}s.`)
    } else if (await tx.clientGrowthPurchase.count({ where: { clientId: client.id, itemKey } })) {
      throw new Error(`You already own ${item.name}.`)
    }

    // Compare-and-set: only succeeds if nothing else spent XP (or used a
    // shield) since we read the row above.
    const updated = await tx.clientGrowthProgress.updateMany({
      where: { clientId: client.id, xpSpent: progress.xpSpent, streakShields: progress.streakShields },
      data: {
        xpSpent: { increment: item.xpCost },
        ...(item.key === 'streak-shield' ? { streakShields: { increment: 1 } } : {}),
      },
    })
    if (updated.count !== 1) throw new Error('Your XP balance just changed - please try again.')

    await tx.clientGrowthPurchase.create({
      data: { organizationId: ctx.organizationId, clientId: client.id, itemKey, xpCost: item.xpCost, purchasedBy: ctx.userId },
    })
  })

  await recordAuditEvent({
    organizationId: ctx.organizationId,
    clientId: client.id,
    userId: ctx.userId,
    action: 'growth.shop_purchase',
    inputSummary: { itemKey, xpCost: item.xpCost },
    result: 'SUCCESS',
  })
  return item
}

/** Equips an owned cosmetic into its slot, or clears the slot when `itemKey` is null. */
export async function equipShopItem(ctx: AuthContext, clientId: string, slot: ShopSlot, itemKey: string | null) {
  assertPermission(ctx, 'growth.write')
  const client = await getAuthorizedClient(ctx, clientId)
  if (!(slot in SLOT_COLUMN)) throw new Error('Unknown slot.')
  if (itemKey !== null) {
    const item = getShopItem(itemKey)
    if (!item || item.slot !== slot) throw new Error('That item doesn’t go there.')
    const owned = await db.clientGrowthPurchase.count({ where: { clientId: client.id, itemKey } })
    if (!owned) throw new Error(`Buy ${item.name} first.`)
  }
  const result = await db.clientGrowthProgress.updateMany({ where: { clientId: client.id }, data: { [SLOT_COLUMN[slot]]: itemKey } })
  if (result.count !== 1) throw new Error('Earn some XP on the Growth Map first.')
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    clientId: client.id,
    userId: ctx.userId,
    action: 'growth.shop_equip',
    inputSummary: { slot, itemKey },
    result: 'SUCCESS',
  })
}

/** How many times this client has bought `itemKey` - keeps each purchase's success URL unique. */
export async function countPurchases(ctx: AuthContext, clientId: string, itemKey: string): Promise<number> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  return db.clientGrowthPurchase.count({ where: { clientId: client.id, itemKey } })
}

export { SHOP_ITEMS }
