import { redirect } from 'next/navigation'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { cosmeticsFor, MAP_THEME_CLASSES } from '@/lib/growth/shop-catalog'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, xpToNextLevel, LEVEL_XP_STEP } from '@/lib/growth/progress'
import { getStageStates } from '@/lib/growth/stages'
import { getActiveDaysThisWeek, getQuestBoard } from '@/lib/growth/quests'
import { getLevelTitles } from '@/lib/growth/levels'
import { listAchievements } from '@/lib/growth/achievements'
import { GrowthMap } from '@/components/growth/growth-map'
import { AchievementsCard, DailyMissionCard, GummyQuoteCard, LevelCard, StreakCard, WeeklyGoalCard } from '@/components/growth/learn-rail'

/**
 * Learn - the Marketing Growth Map (docs/DECISIONS.md 2026-09-26): the
 * illustrated ten-stage map on the left and the reference's right rail
 * (Level, Daily Mission, Streak, Weekly Goal, Achievements, Gummy).
 * Replaces the 2026-09-23 narrow single-column path, which stacked each
 * stage's text under its node and ran ~3,500px tall.
 */
export default async function ClientGrowthPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [progress, stages, quests, achievements, activeDays, levelTitle] = await Promise.all([
    getGrowthProgress(ctx, clientId),
    getStageStates(ctx, clientId),
    getQuestBoard(ctx, clientId),
    listAchievements(ctx, clientId),
    getActiveDaysThisWeek(ctx, clientId),
    getLevelTitles(),
  ])

  const xp = progress?.xp ?? 0
  const level = progress?.level ?? 1
  const canWrite = ctx.permissions.has('growth.write')
  const base = `/dashboard/clients/${clientId}`
  // Daily Mission: a ready-to-claim daily quest first, then the first unfinished one.
  const daily = quests.filter((q) => q.cadence === 'DAILY' && !q.completedAt)
  const dailyMission = daily.find((q) => q.claimable) ?? daily[0] ?? null
  const weeklyGoal = quests.find((q) => q.key === 'weekly-goal')
  const toNext = xpToNextLevel(xp)
  const mapTheme = progress?.equippedMapTheme ? MAP_THEME_CLASSES[progress.equippedMapTheme] : undefined

  return (
    <GummyStyleProvider value={cosmeticsFor(progress)}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <GrowthMap stages={stages} clientId={clientId} canWrite={canWrite} themeClass={mapTheme} />

        <div className="space-y-4">
          <LevelCard
            level={level}
            title={levelTitle(level)}
            xpToNext={toNext}
            pct={Math.round(((LEVEL_XP_STEP - toNext) / LEVEL_XP_STEP) * 100)}
            href={`${base}/profile`}
          />
          <DailyMissionCard quest={dailyMission} clientId={clientId} />
          <StreakCard streak={progress?.streakCount ?? 0} activeDays={activeDays} shields={progress?.streakShields ?? 0} />
          <WeeklyGoalCard goal={weeklyGoal} href={`${base}/quests?tab=weekly`} />
          <AchievementsCard achievements={achievements} href={`${base}/profile`} />
          <GummyQuoteCard />
        </div>
      </div>
    </GummyStyleProvider>
  )
}
