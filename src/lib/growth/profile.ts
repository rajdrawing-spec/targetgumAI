import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { GROWTH_STAGE_DEFS } from './stage-defs'
import { STAGE_XP_REWARD } from './stages'
import { ACHIEVEMENT_CATALOG } from './achievements'
import { getShopItem } from './shop-catalog'

/**
 * Growth Profile data (docs/DECISIONS.md 2026-09-24). Everything here is
 * read from real rows. Marketing results (reach / clicks / conversions)
 * come only from synced CampaignMetric data; when there is none the value
 * is null and the page says so - never an invented number (CLAUDE.md
 * rule 5).
 */

export interface ProfileStats {
  missionsCompleted: number
  stagesCompleted: number
  campaigns: number
  creatives: number
  /** Last 30 days, from synced ad metrics; null = no metrics synced in that window. */
  reach: number | null
  clicks: number | null
  conversions: number | null
}

export async function getProfileStats(ctx: AuthContext, clientId: string, now: Date = new Date()): Promise<ProfileStats> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const since = new Date(now.getTime() - 30 * 86_400_000)
  const [missionsCompleted, stagesCompleted, campaigns, creatives, metrics] = await Promise.all([
    db.clientGrowthMissionProgress.count({ where: { clientId: client.id, completedAt: { not: null } } }),
    db.clientGrowthStageCompletion.count({ where: { clientId: client.id } }),
    db.campaign.count({ where: { clientId: client.id } }),
    db.creativeAsset.count({ where: { clientId: client.id } }),
    db.campaignMetric.aggregate({
      where: { clientId: client.id, date: { gte: since } },
      _sum: { reach: true, clicks: true, conversions: true },
      _count: { _all: true },
    }),
  ])
  const hasMetrics = metrics._count._all > 0
  return {
    missionsCompleted,
    stagesCompleted,
    campaigns,
    creatives,
    reach: hasMetrics ? (metrics._sum.reach ?? null) : null,
    clicks: hasMetrics ? (metrics._sum.clicks ?? null) : null,
    conversions: hasMetrics ? (metrics._sum.conversions ?? null) : null,
  }
}

export interface ActivityItem {
  kind: 'stage' | 'quest' | 'achievement' | 'purchase'
  title: string
  at: Date
  /** XP gained (positive) or spent (negative); null for achievements. */
  xp: number | null
}

/** Newest-first feed of Growth events: stages, quests, badges and shop purchases. */
export async function getRecentGrowthActivity(ctx: AuthContext, clientId: string, limit = 8): Promise<ActivityItem[]> {
  assertPermission(ctx, 'growth.read')
  const client = await getAuthorizedClient(ctx, clientId)
  const [stages, quests, achievements, purchases] = await Promise.all([
    db.clientGrowthStageCompletion.findMany({ where: { clientId: client.id }, orderBy: { completedAt: 'desc' }, take: limit }),
    db.clientGrowthMissionProgress.findMany({
      where: { clientId: client.id, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: { mission: { select: { title: true, xpReward: true } } },
    }),
    db.clientGrowthAchievement.findMany({ where: { clientId: client.id }, orderBy: { unlockedAt: 'desc' }, take: limit }),
    db.clientGrowthPurchase.findMany({ where: { clientId: client.id }, orderBy: { purchasedAt: 'desc' }, take: limit }),
  ])
  const items: ActivityItem[] = [
    ...stages.map((s) => ({
      kind: 'stage' as const,
      title: `Completed stage: ${GROWTH_STAGE_DEFS.find((d) => d.key === s.stage)?.title ?? s.stage}`,
      at: s.completedAt,
      xp: STAGE_XP_REWARD,
    })),
    ...quests.map((q) => ({ kind: 'quest' as const, title: `Quest: ${q.mission.title}`, at: q.completedAt!, xp: q.mission.xpReward })),
    ...achievements.map((a) => ({
      kind: 'achievement' as const,
      title: `Achievement unlocked: ${ACHIEVEMENT_CATALOG.find((d) => d.key === a.achievementKey)?.title ?? a.achievementKey}`,
      at: a.unlockedAt,
      xp: null,
    })),
    ...purchases.map((p) => ({ kind: 'purchase' as const, title: `Bought ${getShopItem(p.itemKey)?.name ?? p.itemKey}`, at: p.purchasedAt, xp: -p.xpCost })),
  ]
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit)
}
