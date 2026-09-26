'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { completeStage, getStageStates } from '@/lib/growth/stages'
import { recordMissionProgress } from '@/lib/growth/missions'
import { STAGE_BRIDGES } from '@/lib/growth/stage-bridges'
import { claimVerifiedQuest } from '@/lib/growth/quests'
import { getQuestDef } from '@/lib/growth/quest-defs'
import { countPurchases, equipShopItem, purchaseShopItem } from '@/lib/growth/shop'
import type { ShopSlot } from '@/lib/growth/shop-catalog'
import { getClientBrainSection, updateClientBrainSection } from '@/lib/clients/brain'
import { AuthenticationError } from '@/lib/rbac/errors'
import type { GrowthStageKey } from '@prisma/client'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions for the Growth Map guided-onboarding wizard - same
 * convention as `src/app/dashboard/clients/actions.ts`: resolve ctx, parse
 * the form/args, call the permission/tenant-checked lib function, return an
 * ActionResult.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

function revalidateGrowth(clientId: string) {
  // The whole Client Workspace: Growth Map, Quests, Shop, Profile and the
  // layout's equipped-cosmetics provider all read the same progress row.
  revalidatePath(`/dashboard/clients/${clientId}`, 'layout')
}

/**
 * Quest / Shop actions return the URL of a flag route - `/quests/claimed/
 * <key>`, `/shop/bought/<key>/<n>` - which renders the same page plus a
 * celebration banner, and their forms (`ActionForm fullReload`) follow it
 * with a full page load. They deliberately don't revalidatePath or
 * redirect() in place.
 *
 * Why (docs/DECISIONS.md 2026-09-24): in this app, client-side router
 * transitions within the Client Workspace intermittently never commit -
 * measured on pages this change doesn't touch too (a same-page
 * navigation on the client Overview succeeded 2/6 on the pre-change
 * build). Here that left "Claim XP" stuck on "Claiming…" up to 8/8 times
 * even though the claim had saved, including with an in-place re-render
 * and with a server redirect(). A full page load can't be dropped, and
 * it always renders fresh data, so no revalidation is needed.
 * Errors still come back as an ActionResult and show inline.
 */
const questTab = (key: string) => (getQuestDef(key)?.cadence ?? 'DAILY').toLowerCase()
const questsUrl = (clientId: string, key: string, ...flag: string[]) =>
  `/dashboard/clients/${clientId}/quests/${flag.map(encodeURIComponent).join('/')}?tab=${questTab(key)}`
const shopUrl = (clientId: string, tab: string, ...flag: string[]) => `/dashboard/clients/${clientId}/shop/${flag.map(encodeURIComponent).join('/')}?tab=${tab}`

/**
 * `next=bridge` (the "Claim XP & <apply it>" button) redirects into the
 * stage's real feature screen instead of back to the map. The target is
 * looked up from STAGE_BRIDGES by stage key - the form only chooses
 * between two server-known destinations, never supplies a URL.
 *
 * Redirects server-side (`redirect()`, which runAction lets through)
 * rather than returning `redirectTo`: the client-side `router.push` that
 * ActionForm does for `redirectTo` was measured dropping ~1 in 5 times
 * here, racing the revalidation refresh - a server redirect arrives in
 * the same response as the revalidated data, so it can't be lost.
 */
export async function completeStageAction(clientId: string, stage: GrowthStageKey, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('complete-growth-stage', async () => {
    const ctx = await requireCtx()
    await completeStage(ctx, clientId, stage)
    revalidateGrowth(clientId)
    redirect(formString(formData, 'next') === 'bridge' ? STAGE_BRIDGES[stage].href(clientId) : `/dashboard/clients/${clientId}/growth`)
  })
}

const lines = (value: string | undefined) => (value ? value.split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean) : undefined)

/**
 * Stage 1's plain-language business intake form (`BusinessIntakeForm`) -
 * writes straight into the Client Brain's `business` section rather than a
 * separate table, since that's the same data the Business tab and the AI
 * Gateway already read. `updateClientBrainSection` replaces the whole
 * section on write, so existing fields (e.g. ones set from the Business tab
 * directly) are fetched first and merged in, never dropped. Unlike a quiz
 * stage this form stays open after completion - a business can change - so
 * `completeStage` (which only accepts the client's *current* stage) is only
 * called the first time, while `DEFINE_BUSINESS` is actually still current.
 */
export async function completeBusinessIntakeAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('complete-business-intake', async () => {
    const ctx = await requireCtx()
    const existing = ((await getClientBrainSection(ctx, clientId, 'business')) ?? {}) as Record<string, unknown>
    const merged = {
      ...existing,
      productsServices: formString(formData, 'productsServices') ?? existing.productsServices,
      offers: formString(formData, 'offers') ?? existing.offers,
      locations: lines(formString(formData, 'locations')) ?? existing.locations,
      businessGoals: lines(formString(formData, 'businessGoals')) ?? existing.businessGoals,
    }
    await updateClientBrainSection(ctx, clientId, 'business', merged)

    const stages = await getStageStates(ctx, clientId)
    const defineBusiness = stages.find((s) => s.key === 'DEFINE_BUSINESS')
    if (defineBusiness && defineBusiness.status !== 'done') {
      await completeStage(ctx, clientId, 'DEFINE_BUSINESS')
    }

    revalidateGrowth(clientId)
    return actionOk('Saved! Your business info is ready.', { redirectTo: `/dashboard/clients/${clientId}/growth` })
  })
}

export async function recordMissionProgressAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('record-growth-mission-progress', async () => {
    const ctx = await requireCtx()
    const missionKey = formString(formData, 'missionKey')
    if (!missionKey) throw new Error('Mission key is required.')
    const incrementByRaw = formString(formData, 'incrementBy')
    const incrementBy = incrementByRaw ? Number(incrementByRaw) : 1
    const result = await recordMissionProgress(ctx, clientId, missionKey, incrementBy)
    // Same full-reload success pattern as the quest actions below.
    return actionOk(undefined, {
      redirectTo: result.completedAt
        ? questsUrl(clientId, missionKey, 'claimed', missionKey)
        : questsUrl(clientId, missionKey, 'logged', missionKey, String(result.progressCount)),
    })
  })
}

/** Claims a verified quest's XP - the lib recounts the real records first (quests.ts). */
export async function claimQuestAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('claim-growth-quest', async () => {
    const ctx = await requireCtx()
    const questKey = formString(formData, 'questKey')
    if (!questKey) throw new Error('Quest key is required.')
    await claimVerifiedQuest(ctx, clientId, questKey)
    return actionOk(undefined, { redirectTo: questsUrl(clientId, questKey, 'claimed', questKey) })
  })
}

export async function purchaseShopItemAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('growth-shop-purchase', async () => {
    const ctx = await requireCtx()
    const itemKey = formString(formData, 'itemKey')
    if (!itemKey) throw new Error('Item is required.')
    const item = await purchaseShopItem(ctx, clientId, itemKey)
    // The purchase count keeps a repeat buy (a 2nd Streak Shield) on its own URL.
    const owned = await countPurchases(ctx, clientId, item.key)
    return actionOk(undefined, { redirectTo: shopUrl(clientId, item.category, 'bought', item.key, String(owned)) })
  })
}

const SLOTS: readonly ShopSlot[] = ['mascot', 'mapTheme', 'celebration']
const SLOT_TAB: Record<ShopSlot, string> = { mascot: 'mascots', mapTheme: 'themes', celebration: 'rewards' }

/** `itemKey` blank = unequip the slot. */
export async function equipShopItemAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('growth-shop-equip', async () => {
    const ctx = await requireCtx()
    const slot = formString(formData, 'slot') as ShopSlot | undefined
    if (!slot || !SLOTS.includes(slot)) throw new Error('Unknown slot.')
    const itemKey = formString(formData, 'itemKey') ?? null
    await equipShopItem(ctx, clientId, slot, itemKey)
    return actionOk(undefined, { redirectTo: shopUrl(clientId, SLOT_TAB[slot], 'equipped', itemKey ?? 'none') })
  })
}
