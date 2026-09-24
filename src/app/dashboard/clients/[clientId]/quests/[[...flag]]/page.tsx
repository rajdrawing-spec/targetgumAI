import { redirect } from 'next/navigation'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { cosmeticsFor } from '@/lib/growth/shop-catalog'
import Link from 'next/link'
import { Check, Flame, Shield } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, levelUpFrom } from '@/lib/growth/progress'
import { getLevelTitles } from '@/lib/growth/levels'
import { ProgressBar } from '@/components/gamification/stats'
import { getActiveDaysThisWeek, getQuestBoard, type QuestCard as QuestCardData } from '@/lib/growth/quests'
import type { ActionResult } from '@/lib/actions/result'
import { GummyCoach, GummyMascot } from '@/components/growth/mascot'
import { QuestCard } from '@/components/growth/quest-card'
import { CelebrationBanner } from '@/components/growth/celebration-banner'
import { ClientTabs } from '@/components/ui/client-tabs'
import { cn } from '@/lib/utils'
import { claimQuestAction, recordMissionProgressAction } from '../../growth/actions'

const TABS = [
  { value: 'daily', label: 'Daily', cadence: 'DAILY' },
  { value: 'weekly', label: 'Weekly', cadence: 'WEEKLY' },
  { value: 'special', label: 'Special', cadence: 'SPECIAL' },
] as const

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Marketing Quests (docs/DECISIONS.md 2026-09-24) - Daily / Weekly /
 * Special quests for this client, each tied to real marketing work.
 */
export default async function QuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; flag?: string[] }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ clientId, flag = [] }, { tab }, ctx] = await Promise.all([params, searchParams, getCurrentAuthContext()])
  // `/quests/claimed/<key>` and `/quests/logged/<key>/<n>` are where the
  // claim / log actions redirect (growth/actions.ts) - a different
  // pathname on purpose, see the note there. Same page, plus a banner.
  const [flagKind, flagKey] = flag
  const claimed = flagKind === 'claimed' ? flagKey : undefined
  const logged = flagKind === 'logged' ? flagKey : undefined
  if (!ctx) redirect('/sign-in')

  const now = new Date()
  const [board, activeDays, progress] = await Promise.all([getQuestBoard(ctx, clientId, now), getActiveDaysThisWeek(ctx, clientId, now), getGrowthProgress(ctx, clientId)])
  const canWrite = ctx.permissions.has('growth.write')
  const streak = progress?.streakCount ?? 0
  const todayIndex = (now.getUTCDay() + 6) % 7
  // Flags from the claim / log actions' redirect - shown only if true.
  const justClaimed = board.find((q) => q.key === claimed && q.completedAt)
  const justLogged = !justClaimed ? board.find((q) => q.key === logged && !q.completedAt) : undefined
  // A claim that crossed a level boundary gets the level-up celebration.
  const newLevel = justClaimed && progress ? levelUpFrom(progress.xp, justClaimed.xpReward) : null
  const levelTitle = newLevel ? (await getLevelTitles())(newLevel) : null
  const weeklyGoal = board.find((q) => q.key === 'weekly-goal')
  const shields = progress?.streakShields ?? 0

  const claimAction = claimQuestAction.bind(null, clientId)
  const logAction = recordMissionProgressAction.bind(null, clientId)

  return (
    <GummyStyleProvider value={cosmeticsFor(progress)}>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-foreground">Marketing Quests</h2>
            <p className="text-muted-foreground">Complete quests. Earn XP. Grow your business.</p>
          </div>
          <GummyCoach mood="cheer" mascotClassName="h-16 w-14" tone="tint">
            Keep going!
          </GummyCoach>
        </div>

        {justClaimed &&
          (newLevel ? (
            <CelebrationBanner title={`Level up! You're now Level ${newLevel} · ${levelTitle}`}>
              {justClaimed.title} earned +{justClaimed.xpReward} XP and took this business to a new level.
            </CelebrationBanner>
          ) : (
            <CelebrationBanner title={`Quest complete! +${justClaimed.xpReward} XP`}>
              {justClaimed.title} - nice work. Your streak and level are up to date.
            </CelebrationBanner>
          ))}
        {justLogged && (
          <CelebrationBanner title="Progress saved" mood="cheer">
            {justLogged.title}: {justLogged.progressCount} of {justLogged.targetCount}. Keep going!
          </CelebrationBanner>
        )}

        <section aria-label="This week" className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-2">
            <Flame className="h-9 w-9 text-mustard motion-safe:animate-flicker" aria-hidden="true" />
            <div>
              <p className="font-display text-3xl font-extrabold leading-none text-foreground">{streak}</p>
              <p className="text-xs text-muted-foreground">Day streak</p>
              {shields > 0 && (
                <Link
                  href={`/dashboard/clients/${clientId}/shop?tab=boosts`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-mustard hover:underline"
                  title="Each Streak Shield covers one missed day automatically"
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" /> {shields} shield{shields === 1 ? '' : 's'} ready
                </Link>
              )}
            </div>
          </div>
          <ol className="grid flex-1 grid-cols-7 gap-1 sm:ml-6">
            {DAY_LABELS.map((label, i) => (
              <li key={label} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2',
                    activeDays[i] ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted',
                    i === todayIndex && !activeDays[i] && 'border-primary/50',
                  )}
                >
                  {activeDays[i] && <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
                </span>
                <span className={cn('text-[11px]', i === todayIndex ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                  {label}
                  <span className="sr-only">{activeDays[i] ? ': active' : ': no activity'}</span>
                </span>
              </li>
            ))}
          </ol>
          {weeklyGoal && (
            <div className="sm:w-44 sm:border-l sm:border-border sm:pl-5">
              <p className="text-sm font-bold text-foreground">Weekly goal</p>
              <ProgressBar
                className="mt-1.5 h-2.5"
                value={weeklyGoal.progressCount}
                max={weeklyGoal.targetCount}
                label="Weekly goal progress"
                tone={weeklyGoal.completedAt ? 'success' : 'primary'}
              />
              <p className={cn('mt-1 text-xs', weeklyGoal.claimable ? 'font-semibold text-success' : 'text-muted-foreground')}>
                {weeklyGoal.completedAt
                  ? 'Reached - bonus claimed!'
                  : weeklyGoal.claimable
                    ? `Reached! Claim +${weeklyGoal.xpReward} XP in Weekly`
                    : `${weeklyGoal.progressCount} of ${weeklyGoal.targetCount} quests · +${weeklyGoal.xpReward} XP bonus`}
              </p>
            </div>
          )}
        </section>

        <ClientTabs
          param="tab"
          basePath={`/dashboard/clients/${clientId}/quests`}
          initial={tab ?? 'daily'}
          label="Quest types"
          tabs={TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: board.filter((q) => q.cadence === t.cadence && !q.completedAt).length,
            content: (
              <QuestTab
                tab={t}
                quests={board.filter((q) => q.cadence === t.cadence)}
                clientId={clientId}
                canWrite={canWrite}
                claimAction={claimAction}
                logAction={logAction}
              />
            ),
          }))}
        />
      </div>
    </GummyStyleProvider>
  )
}

type BoundAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>

function QuestTab({
  tab,
  quests,
  clientId,
  canWrite,
  claimAction,
  logAction,
}: {
  tab: (typeof TABS)[number]
  quests: QuestCardData[]
  clientId: string
  canWrite: boolean
  claimAction: BoundAction
  logAction: BoundAction
}) {
  const allDone = quests.length > 0 && quests.every((q) => q.completedAt)
  return (
    <div className="space-y-5">
      {quests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border p-10 text-center">
          <GummyMascot mood="thinking" className="h-20 w-16" />
          <p className="font-display text-lg font-bold text-foreground">No {tab.label.toLowerCase()} quests right now</p>
          <p className="text-sm text-muted-foreground">Check the other tabs - there&apos;s always something to grow.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {quests.map((q) => (
            <QuestCard key={q.key} quest={q} clientId={clientId} canWrite={canWrite} claimAction={claimAction} logAction={logAction} />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-4 rounded-3xl bg-primary-tint p-5">
        <GummyMascot mood={allDone ? 'celebrate' : 'happy'} animate={allDone} className="h-20 w-16 shrink-0" />
        <div>
          <p className="font-display text-xl font-extrabold text-foreground">{allDone ? "You're all caught up!" : "You're doing great!"}</p>
          <p className="text-sm text-muted-foreground">
            {allDone
              ? `Every ${tab.label.toLowerCase()} quest is done. New ones arrive ${tab.value === 'special' ? 'as TargetGum grows' : tab.value === 'daily' ? 'tomorrow' : 'next week'}.`
              : 'Every quest is a real step for this business - finish one to keep the streak alive.'}
          </p>
        </div>
      </div>
    </div>
  )
}
