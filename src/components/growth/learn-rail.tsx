import Link from 'next/link'
import { ArrowRight, BarChart3, Flame, Lock, Target, Trophy, Users, Palette, Sparkles, Crown } from 'lucide-react'
import type { QuestCard } from '@/lib/growth/quests'
import { MISSION_SCREEN_LINKS } from '@/lib/growth/mission-links'
import { ProgressBar } from '@/components/gamification/stats'
import { cn } from '@/lib/utils'
import { GummyMascot } from './mascot'

/**
 * The Learn page's right-hand rail, per the approved reference
 * (docs/DECISIONS.md 2026-09-26): Level, Daily Mission, Current Streak,
 * Weekly Goal, Achievements and a Gummy quote. Every number comes from
 * the client's real progress/quest/achievement rows - nothing here is
 * decorative data.
 */

function RailCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-3xl border-2 border-border bg-card p-4 sm:p-5', className)}>{children}</section>
}

export function LevelCard({ level, title, xpToNext, pct, href }: { level: number; title: string; xpToNext: number; pct: number; href: string }) {
  return (
    <RailCard className="relative overflow-hidden">
      <Link href={href} className="flex items-center gap-3 pr-20">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-primary/20 bg-card text-primary">
          <Target className="h-7 w-7" strokeWidth={2.6} aria-hidden="true" />
        </span>
        <span>
          <span className="block font-display text-2xl font-extrabold leading-none text-foreground">Level {level}</span>
          <span className="mt-1 block text-sm font-medium text-muted-foreground">{title}</span>
        </span>
      </Link>
      <ProgressBar value={pct} max={100} label={`Progress to level ${level + 1}`} className="mt-4 h-3 pr-20" />
      <p className="mt-2 text-sm text-muted-foreground">
        {xpToNext.toLocaleString()} XP to Level {level + 1}
      </p>
      <GummyMascot mood="cheer" className="absolute bottom-2 right-3 h-24 w-20" />
    </RailCard>
  )
}

export function DailyMissionCard({ quest, clientId }: { quest: QuestCard | null; clientId: string }) {
  const questsHref = `/dashboard/clients/${clientId}/quests`
  if (!quest) {
    return (
      <RailCard>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Target className="h-5 w-5 text-primary" aria-hidden="true" /> Daily Mission
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Today&apos;s missions are done - see you tomorrow!</p>
      </RailCard>
    )
  }
  const link = MISSION_SCREEN_LINKS[quest.key]
  const actionHref = quest.claimable || !link ? questsHref : link.href(clientId)
  return (
    <RailCard>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <Target className="h-5 w-5 text-primary" aria-hidden="true" /> Daily Mission
      </h2>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary-tint p-3">
        <Target className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
        <p className="flex-1 text-sm font-semibold leading-snug text-foreground">{quest.title}</p>
        <span className="shrink-0 font-display text-sm font-extrabold text-primary">+{quest.xpReward} XP</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={quest.progressCount} max={quest.targetCount} label={`${quest.title} progress`} className="h-2.5 flex-1" />
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {quest.progressCount} / {quest.targetCount}
        </span>
      </div>
      <Link
        href={actionHref}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-[0_4px_0_#9A0F14] transition-transform active:translate-y-[2px] active:shadow-none"
      >
        {quest.claimable ? 'Claim XP' : 'Start Mission'}
      </Link>
    </RailCard>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function StreakCard({ streak, activeDays, shields }: { streak: number; activeDays: boolean[]; shields: number }) {
  return (
    <RailCard>
      <div className="flex items-start gap-3">
        <Flame className="mt-0.5 h-8 w-8 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Current Streak</h2>
          <p className="font-display text-3xl font-extrabold leading-tight text-primary">
            {streak} day{streak === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-muted-foreground">
            {streak > 0 ? 'Keep going!' : 'Finish a lesson or quest to start one.'}
            {shields > 0 && ` · ${shields} Streak Shield${shields === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1 text-center" aria-label="Active days this week">
        {DAYS.map((d, i) => (
          <li key={d} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs',
                activeDays[i] ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted',
              )}
            >
              {activeDays[i] ? '✓' : ''}
              <span className="sr-only">{activeDays[i] ? 'active' : 'not active'}</span>
            </span>
            <span className="text-[11px] text-muted-foreground">{d}</span>
          </li>
        ))}
      </ol>
    </RailCard>
  )
}

export function WeeklyGoalCard({ goal, href }: { goal: QuestCard | undefined; href: string }) {
  if (!goal) return null
  return (
    <RailCard>
      <Link href={href} className="block">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" /> Weekly Goal
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {goal.completedAt ? 'Goal reached - bonus earned!' : `Complete ${goal.progressCount} of ${goal.targetCount} quests`}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={goal.progressCount} max={goal.targetCount} label="Weekly goal progress" className="h-3 flex-1" tone={goal.completedAt ? 'success' : 'primary'} />
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {goal.progressCount} / {goal.targetCount}
          </span>
        </div>
      </Link>
    </RailCard>
  )
}

const BADGE_STYLE: Record<string, { icon: typeof Target; bg: string }> = {
  'first-campaign': { icon: Target, bg: 'bg-gradient-to-b from-[#F4555A] to-[#C8161C]' },
  'audience-explorer': { icon: Users, bg: 'bg-gradient-to-b from-[#A66BF2] to-[#6D37C8]' },
  '7-day-streak': { icon: Flame, bg: 'bg-gradient-to-b from-[#FFB23E] to-[#F06A0F]' },
  'creative-master': { icon: Palette, bg: 'bg-gradient-to-b from-[#4FC3F7] to-[#1E88E5]' },
  'optimization-expert': { icon: Sparkles, bg: 'bg-gradient-to-b from-[#4ADE80] to-[#16A34A]' },
  'growth-master': { icon: Crown, bg: 'bg-gradient-to-b from-[#FACC15] to-[#CA8A04]' },
}

export function AchievementsCard({
  achievements,
  href,
}: {
  achievements: Array<{ key: string; title: string; description: string; unlocked: boolean }>
  href: string
}) {
  return (
    <RailCard>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> Achievements
        </h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          View All <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4">
        {achievements.map((a) => {
          const style = BADGE_STYLE[a.key] ?? { icon: Target, bg: 'bg-primary' }
          const Icon = a.unlocked ? style.icon : Lock
          return (
            <li key={a.key} className="flex flex-col items-center gap-1.5 text-center" title={a.description}>
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center text-white [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                  a.unlocked ? style.bg : 'bg-gradient-to-b from-[#E4E6EA] to-[#C3C7CE] text-[#6B7280]',
                )}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium leading-tight text-foreground">{a.title}</span>
              <span className="sr-only">{a.unlocked ? 'unlocked' : 'locked'}</span>
            </li>
          )
        })}
      </ul>
    </RailCard>
  )
}

export function GummyQuoteCard() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-primary-tint p-4 pl-28 sm:p-5 sm:pl-32">
      <GummyMascot mood="happy" className="absolute bottom-0 left-2 h-28 w-24" />
      <p className="font-display text-lg font-bold leading-snug text-foreground">
        &ldquo;Small actions. Big results. Let&apos;s grow together!&rdquo;
      </p>
      <p className="mt-2 text-sm text-muted-foreground">- Gummy</p>
    </section>
  )
}
