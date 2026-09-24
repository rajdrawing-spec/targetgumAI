import { redirect } from 'next/navigation'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { Flame, Gem, PartyPopper, Shield } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getShopState } from '@/lib/growth/shop'
import { cosmeticsFor, getShopItem, MAP_THEME_CLASSES, MASCOT_OUTFITS, SHOP_CATEGORIES, SHOP_ITEMS, type ShopItem } from '@/lib/growth/shop-catalog'
import { CelebrationBanner } from '@/components/growth/celebration-banner'
import { GummyMascot } from '@/components/growth/mascot'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { ClientTabs } from '@/components/ui/client-tabs'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/actions/result'
import type { ReactNode } from 'react'
import { equipShopItemAction, purchaseShopItemAction } from '../../growth/actions'

/**
 * Growth Shop (docs/DECISIONS.md 2026-09-24): spend this client's earned
 * XP on cosmetic and convenience items. Business features are never sold
 * here - see src/lib/growth/shop-catalog.ts.
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; flag?: string[] }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ clientId, flag = [] }, { tab }, ctx] = await Promise.all([params, searchParams, getCurrentAuthContext()])
  // `/shop/bought/<key>/<n>` and `/shop/equipped/<key|none>` are where the
  // buy / equip actions redirect (growth/actions.ts). Same page, plus a banner.
  const [flagKind, flagKey] = flag
  const bought = flagKind === 'bought' ? flagKey : undefined
  const equipped = flagKind === 'equipped' ? flagKey : undefined
  if (!ctx) redirect('/sign-in')

  const shop = await getShopState(ctx, clientId)
  const canWrite = ctx.permissions.has('growth.write')
  // Flags from the buy / equip actions' redirect - shown only if true.
  const justBought = bought && shop.owned.has(bought) ? getShopItem(bought) : undefined
  const justEquipped = equipped && equipped !== 'none' && Object.values(shop.equipped).includes(equipped) ? getShopItem(equipped) : undefined
  const buy = purchaseShopItemAction.bind(null, clientId)
  const equip = equipShopItemAction.bind(null, clientId)

  return (
    <GummyStyleProvider value={cosmeticsFor({ equippedMascot: shop.equipped.mascot, equippedCelebration: shop.equipped.celebration })}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-foreground">Growth Shop</h2>
            <p className="max-w-md text-muted-foreground">Spend XP on boosts and customizations. Your level never goes down when you shop.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-2xl border-2 border-border bg-card p-3">
              <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-foreground">
                <Gem className="h-5 w-5 text-primary" aria-hidden="true" /> {shop.balance.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">XP to spend</p>
            </div>
            <div className="rounded-2xl border-2 border-border bg-card p-3">
              <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-foreground">
                <Flame className="h-5 w-5 text-mustard" aria-hidden="true" /> {shop.streakCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Day streak{shop.streakShields > 0 ? ` · ${shop.streakShields} shield${shop.streakShields === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          </div>
        </div>

        {justBought && (
          <CelebrationBanner title={`${justBought.name} is yours!`}>
            {justBought.kind === 'consumable' ? 'It will protect your streak automatically.' : 'Equip it below to see it across this client’s workspace.'}
          </CelebrationBanner>
        )}
        {!justBought && justEquipped && <CelebrationBanner title={`${justEquipped.name} equipped!`} mood="cheer" />}
        {!justBought && equipped === 'none' && <CelebrationBanner title="Back to classic" mood="happy" />}

        <ClientTabs
          param="tab"
          basePath={`/dashboard/clients/${clientId}/shop`}
          initial={tab ?? 'boosts'}
          label="Shop categories"
          tabs={SHOP_CATEGORIES.map((c) => ({
            value: c.key,
            label: c.label,
            content: (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SHOP_ITEMS.filter((i) => i.category === c.key).map((item) => (
                  <ShopItemCard key={item.key} item={item} shop={shop} canWrite={canWrite} buy={buy} equip={equip} />
                ))}
              </ul>
            ),
          }))}
        />

        <div className="flex items-center gap-4 rounded-3xl bg-primary-tint p-5">
          <GummyMascot mood="cheer" className="h-20 w-16 shrink-0" />
          <div>
            <p className="font-display text-xl font-extrabold text-foreground">Level up your journey!</p>
            <p className="text-sm text-muted-foreground">Earn XP by finishing Growth Map stages and quests. Everything you need to run real marketing is never behind XP.</p>
          </div>
        </div>
      </div>
    </GummyStyleProvider>
  )
}

type ShopState = Awaited<ReturnType<typeof getShopState>>
type BoundAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>

function ItemArt({ item }: { item: ShopItem }) {
  if (item.slot === 'mascot') return <GummyMascot mood="happy" outfit={MASCOT_OUTFITS[item.key] ?? null} className="h-24 w-20" />
  if (item.slot === 'mapTheme') {
    return (
      <span className={cn('flex h-24 w-full items-center justify-center rounded-2xl border border-border', MAP_THEME_CLASSES[item.key])}>
        <GummyMascot mood="happy" outfit={null} className="h-16 w-14" />
      </span>
    )
  }
  if (item.slot === 'celebration') return <PartyPopper className="h-20 w-20 text-mustard" aria-hidden="true" />
  return <Shield className="h-20 w-20 fill-warning-bg text-mustard" aria-hidden="true" />
}

function ShopItemCard({ item, shop, canWrite, buy, equip }: { item: ShopItem; shop: ShopState; canWrite: boolean; buy: BoundAction; equip: BoundAction }) {
  const owned = shop.owned.has(item.key)
  const equipped = item.slot ? shop.equipped[item.slot] === item.key : false
  const atMax = item.kind === 'consumable' && shop.streakShields >= (item.maxHeld ?? 1)
  const shortBy = item.xpCost - shop.balance

  let action: ReactNode = null
  if (!canWrite) action = null
  else if (item.kind === 'cosmetic' && owned) {
    action = (
      <ActionForm action={equip} fullReload>
        <input type="hidden" name="slot" value={item.slot} />
        <input type="hidden" name="itemKey" value={equipped ? '' : item.key} />
        <SubmitButton variant={equipped ? 'outline' : 'primary'} className="w-full" pendingLabel="Saving…">
          {equipped ? 'Unequip' : 'Equip'}
        </SubmitButton>
      </ActionForm>
    )
  } else if (atMax) {
    action = <p className="text-center text-sm font-semibold text-muted-foreground">Holding the max ({item.maxHeld})</p>
  } else if (shortBy > 0) {
    action = (
      <button type="button" disabled className="h-10 w-full rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
        Need {shortBy.toLocaleString()} more XP
      </button>
    )
  } else {
    action = (
      <ActionForm action={buy} fullReload>
        <input type="hidden" name="itemKey" value={item.key} />
        <SubmitButton className="w-full uppercase tracking-wide" pendingLabel="Buying…">
          Buy
        </SubmitButton>
      </ActionForm>
    )
  }

  return (
    <li className={cn('flex flex-col gap-3 rounded-3xl border-2 bg-card p-5', equipped ? 'border-primary' : 'border-border')}>
      <div className="flex h-28 items-center justify-center">
        <ItemArt item={item} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-lg font-bold text-foreground">{item.name}</p>
          {equipped && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Equipped</span>}
          {item.kind === 'consumable' && shop.streakShields > 0 && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning">
              {shop.streakShields}/{item.maxHeld} held
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
      </div>
      <p className="font-display text-lg font-extrabold text-primary">{owned && item.kind === 'cosmetic' ? 'Owned' : `${item.xpCost.toLocaleString()} XP`}</p>
      {action}
    </li>
  )
}
