import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { cosmeticsFor } from '@/lib/growth/shop-catalog'
import { Award, Check, Crown, Flame, Gem, Lock, Megaphone, MousePointerClick, Palette, ShoppingBag, Target, Trophy, Users, Zap, type LucideIcon } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClientCached } from '@/lib/db/tenant'
import { getGrowthProgress } from '@/lib/growth/progress'
import { getLevelTitles, xpForLevel } from '@/lib/growth/levels'
import { getStageStates } from '@/lib/growth/stages'
import { listAchievements } from '@/lib/growth/achievements'
import { getProfileStats, getRecentGrowthActivity, type ActivityItem } from '@/lib/growth/profile'
import { GummyCoach } from '@/components/growth/mascot'
import { ProgressBar } from '@/components/gamification/stats'
import { formatRelative, initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Growth Profile (docs/DECISIONS.md 2026-09-24): this client's level,
 * XP, streak, achievements, Growth Map progress and recent activity.
 * Marketing results come only from synced campaign metrics - shown as
 * "—" with a prompt to connect an account when there are none.
 */
export default async function GrowthProfilePage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [client, progress, titleFor, stages, achievements, stats, activity] = await Promise.all([
    getAuthorizedClientCached(ctx, clientId),
    getGrowthProgress(ctx, clientId),
    getLevelTitles(),
    getStageStates(ctx, clientId),
    listAchievements(ctx, clientId),
    getProfileStats(ctx, clientId),
    getRecentGrowthActivity(ctx, clientId),
  ])

  const xp = progress?.xp ?? 0
  const level = progress?.level ?? 1
  const streak = progress?.streakCount ?? 0
  const levelStart = xpForLevel(level)
  const levelEnd = xpForLevel(level + 1)
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString())

  return (
    <GummyStyleProvider value={cosmeticsFor(progress)}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section aria-label="Level" className="flex flex-col gap-5 rounded-3xl border-2 border-border bg-card p-5 sm:flex-row sm:items-center">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary font-display text-2xl font-extrabold text-primary-foreground">
              {initials(client.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-3xl font-extrabold leading-tight text-foreground">{client.name}</h2>
              <p className="text-sm">
                <span className="font-bold text-foreground">Level {level}</span> <span className="text-muted-foreground">{titleFor(level)}</span>
              </p>
              <ProgressBar className="mt-3" value={xp - levelStart} max={levelEnd - levelStart} label={`Progress to level ${level + 1}`} />
              <p className="mt-1 text-xs text-muted-foreground">
                {xp.toLocaleString()} / {levelEnd.toLocaleString()} XP to Level {level + 1} ({titleFor(level + 1)})
              </p>
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile icon={Flame} tone="text-mustard" value={String(streak)} label="Day streak" />
            <Tile icon={Crown} tone="text-mustard" value={String(level)} label="Current level" />
            <Tile icon={Zap} tone="text-primary" value={xp.toLocaleString()} label="Total XP" />
            <Tile icon={Target} tone="text-primary" value={String(stats.missionsCompleted)} label="Quests completed" />
          </dl>

          <section aria-labelledby="stats-title" className="rounded-3xl border-2 border-border bg-card p-5">
            <h3 id="stats-title" className="font-display text-xl font-bold text-foreground">
              Marketing stats
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Tile icon={Megaphone} tone="text-success" value={String(stats.campaigns)} label="Campaigns" />
              <Tile icon={Palette} tone="text-primary" value={String(stats.creatives)} label="Creatives" />
              <Tile icon={Users} tone="text-info" value={fmt(stats.reach)} label="Reach · 30d" />
              <Tile icon={MousePointerClick} tone="text-mustard" value={fmt(stats.clicks)} label="Clicks · 30d" />
              <Tile icon={Award} tone="text-success" value={fmt(stats.conversions)} label="Conversions · 30d" />
            </dl>
            {stats.reach === null && (
              <p className="mt-3 text-sm text-muted-foreground">
                No campaign results synced in the last 30 days.{' '}
                <Link href={`/dashboard/clients/${clientId}/connections`} className="font-semibold text-primary hover:underline">
                  Connect an ads account
                </Link>{' '}
                to see reach, clicks and conversions here.
              </p>
            )}
          </section>

          <section aria-labelledby="achievements-title" className="rounded-3xl border-2 border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 id="achievements-title" className="font-display text-xl font-bold text-foreground">
                Achievements
              </h3>
              <span className="text-sm font-semibold text-muted-foreground">
                {unlockedCount} / {achievements.length}
              </span>
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
              {achievements.map((a) => (
                <li key={a.key} className="flex flex-col items-center gap-1.5 text-center" title={a.description}>
                  <span
                    className={cn(
                      'flex h-16 w-16 items-center justify-center rounded-2xl border-b-4',
                      a.unlocked ? 'rotate-3 border-primary-hover bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {a.unlocked ? <Trophy className="h-7 w-7" aria-hidden="true" /> : <Lock className="h-6 w-6" aria-hidden="true" />}
                  </span>
                  <span className={cn('text-xs font-semibold leading-tight', a.unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                    {a.title}
                    <span className="sr-only">{a.unlocked ? ' (unlocked)' : ' (locked)'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="map-title" className="rounded-3xl border-2 border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 id="map-title" className="font-display text-xl font-bold text-foreground">
                Growth Map progress
              </h3>
              <Link href={`/dashboard/clients/${clientId}/growth`} className="text-sm font-semibold text-primary hover:underline">
                See map →
              </Link>
            </div>
            <ol className="mt-4 grid grid-cols-5 gap-y-4 sm:grid-cols-10">
              {stages.map((s) => (
                <li key={s.key} className="flex flex-col items-center gap-1 text-center">
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      s.status === 'done' && 'bg-success text-primary-foreground',
                      s.status === 'current' && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                      s.status === 'locked' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {s.status === 'done' ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /> : s.status === 'locked' ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Target className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <span className="px-0.5 text-[11px] leading-tight text-muted-foreground">
                    {s.shortTitle}
                    <span className="sr-only">: {s.status}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section aria-labelledby="activity-title" className="rounded-3xl border-2 border-border bg-card p-5">
            <h3 id="activity-title" className="font-display text-xl font-bold text-foreground">
              Recent activity
            </h3>
            {activity.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing yet - finish a Growth Map stage or a quest to start the story.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activity.map((item, i) => (
                  <ActivityRow key={i} item={item} />
                ))}
              </ul>
            )}
          </section>

          <div className="rounded-3xl bg-primary-tint p-5">
            <GummyCoach mood={streak >= 3 ? 'celebrate' : 'cheer'} mascotClassName="h-20 w-16" animate={streak >= 3}>
              {streak >= 3
                ? `You're on fire - a ${streak}-day streak! Keep completing quests to unlock new levels.`
                : 'Every stage and quest here is real marketing progress. Let’s keep growing!'}
            </GummyCoach>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">Gummy · Your AI Marketing Coach</p>
          </div>
        </aside>
      </div>
    </GummyStyleProvider>
  )
}

function Tile({ icon: Icon, tone, value, label }: { icon: LucideIcon; tone: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-3 text-center">
      <Icon className={cn('h-6 w-6', tone)} aria-hidden="true" />
      <dt className="order-last text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-extrabold leading-none text-foreground">{value}</dd>
    </div>
  )
}

const ACTIVITY_ICONS: Record<ActivityItem['kind'], LucideIcon> = { stage: Check, quest: Target, achievement: Trophy, purchase: ShoppingBag }

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = ACTIVITY_ICONS[item.kind]
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">{item.title}</p>
        <p className="text-xs text-muted-foreground">{formatRelative(item.at)}</p>
      </div>
      {item.xp !== null && (
        <span className={cn('shrink-0 text-sm font-bold', item.xp >= 0 ? 'text-primary' : 'text-muted-foreground')}>
          {item.xp >= 0 ? `+${item.xp}` : item.xp} XP
        </span>
      )}
      {item.xp === null && <Gem className="h-4 w-4 shrink-0 text-mustard" aria-hidden="true" />}
    </li>
  )
}
