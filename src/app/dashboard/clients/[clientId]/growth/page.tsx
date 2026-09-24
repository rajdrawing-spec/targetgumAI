import { redirect } from 'next/navigation'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { cosmeticsFor } from '@/lib/growth/shop-catalog'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Flame, Lock, Target, Trophy, Zap } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, xpToNextLevel } from '@/lib/growth/progress'
import { getStageStates } from '@/lib/growth/stages'
import { getWeeklyMissionCompletionCount } from '@/lib/growth/missions'
import { getQuestBoard } from '@/lib/growth/quests'
import { MAP_THEME_CLASSES } from '@/lib/growth/shop-catalog'
import { listAchievements } from '@/lib/growth/achievements'
import { GROWTH_PHASE_DEFS, phaseStatus, type GrowthPhaseDef, type GrowthPhaseStatus } from '@/lib/growth/phase-defs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { GummyMascot } from '@/components/growth/mascot'
import { CloudIcon, RockIcon, TreeIcon, TrophyIcon } from '@/components/growth/scenery'

/**
 * Growth Map - the guided-onboarding wizard tab (docs/DECISIONS.md
 * 2026-09-22, restructured 2026-09-23 four times: plain collapsible list
 * -> a wide illustrated path with one stop per phase -> a narrow unified
 * path still collapsed to one stop per phase -> this version, which goes
 * back to one full node per *stage* (matching the approved reference
 * mockup exactly - number, title, description, action per stage) with
 * phase banners inserted into the path as section dividers rather than
 * folding stages into a phase-level summary. Still the same narrow,
 * centered layout from the previous round - no `sm:` branching anywhere
 * in this file, `GrowthRoadmap` is one component/markup at every
 * viewport width.
 */

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  )
}

type StageState = Awaited<ReturnType<typeof getStageStates>>[number]
type PhaseData = { phase: GrowthPhaseDef; status: GrowthPhaseStatus; stages: StageState[] }

function quadraticPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  let d = `M ${points[0]!.x} ${points[0]!.y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const midX = (prev.x + cur.x) / 2
    const midY = (prev.y + cur.y) / 2
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]!
  d += ` L ${last.x} ${last.y}`
  return d
}

type PathItem =
  | { kind: 'banner'; phase: GrowthPhaseDef; phaseStatus: GrowthPhaseStatus }
  | { kind: 'stage'; stage: StageState; onLastStageOfPhase: boolean }

/**
 * A narrow, centered winding path - the same markup at any viewport
 * width. Every one of the 10 stages gets its own full node (number,
 * title, description, action) like the approved reference mockup - a
 * colored "PHASE N · TITLE" banner is inserted into the path before each
 * phase's first stage as a section divider, the same idea as Duolingo's
 * own unit banners, rather than collapsing multiple stages into one node.
 * Everything stays centered on its own x position instead of anchored
 * left/right, which is what lets one layout serve mobile and desktop
 * identically. Per-item height varies with status (the current stage
 * needs room for its "Continue" callout and action button), so vertical
 * spacing is computed top-to-bottom in one pass - still plain server-side
 * arithmetic, no client JS or DOM measurement.
 */
function GrowthRoadmap({ phases, clientId, canWrite }: { phases: PhaseData[]; clientId: string; canWrite: boolean }) {
  const TOP_PAD = 130
  const BOTTOM_PAD = 100
  const GAP = 54
  const BANNER_H = 54
  const BANNER_GAP = 30
  const NODE_D = 60
  // Fixed, worst-case budgets rather than guessed per-content estimates -
  // a title/description that only needs one line just leaves extra
  // whitespace, which is far safer than a two-line title/description
  // that was budgeted for one and silently overlaps the next item. This
  // is deliberately generous after the first version of this layout
  // (docs/DECISIONS.md) undercounted wrapped text and the phase banners
  // ended up overlapping the previous stage's content - confirmed fixed
  // by measuring real getBoundingClientRect() gaps via Playwright, not
  // just eyeballing a screenshot.
  const TITLE_H = 42
  const DESC_H = 60
  const ACTION_H = 34
  const CONTINUE_BUBBLE_H = 36
  const STAGE_X = [34, 66, 34, 66, 34, 66, 34, 66, 34, 50] // gentle wobble, narrow - reads the same at any container width

  const items: PathItem[] = []
  for (const p of phases) {
    items.push({ kind: 'banner', phase: p.phase, phaseStatus: p.status })
    p.stages.forEach((stage, i) => items.push({ kind: 'stage', stage, onLastStageOfPhase: i === p.stages.length - 1 }))
  }

  let cumulative = TOP_PAD
  let stageIndex = 0
  const laidOut = items.map((item) => {
    if (item.kind === 'banner') {
      const y = cumulative + BANNER_H / 2
      cumulative += BANNER_H + BANNER_GAP
      return { ...item, x: 50, y }
    }
    const x = STAGE_X[stageIndex] ?? 50
    stageIndex += 1
    const hasAction = item.stage.status !== 'locked'
    const blockHeight = NODE_D + TITLE_H + DESC_H + (hasAction ? ACTION_H : 16) + (item.stage.status === 'current' ? CONTINUE_BUBBLE_H : 0)
    const y = cumulative + blockHeight / 2
    cumulative += blockHeight + GAP
    return { ...item, x, y }
  })
  const pathHeight = cumulative - GAP + BOTTOM_PAD

  const wayPoints = [
    { x: 50, y: TOP_PAD * 0.5 },
    ...laidOut.filter((i) => i.kind === 'stage').map((i) => ({ x: i.x, y: i.y })),
    { x: 50, y: pathHeight - BOTTOM_PAD * 0.5 },
  ]
  const pathD = quadraticPath(wayPoints)

  return (
    <div className="relative mx-auto max-w-xs" style={{ height: pathHeight }}>
      <svg viewBox={`0 0 100 ${pathHeight}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path d={pathD} fill="none" stroke="hsl(var(--primary) / 0.28)" strokeWidth="0.7" strokeDasharray="1.6 2.4" strokeLinecap="round" />
      </svg>

      {/* Decorative scenery - sparse, purely ornamental. */}
      <TreeIcon className="absolute left-[2%] w-7 opacity-60" style={{ top: TOP_PAD * 0.25 }} />
      <RockIcon className="absolute left-[90%] w-6 opacity-50" style={{ top: pathHeight * 0.3 }} />
      <CloudIcon className="absolute left-[82%] w-14 opacity-60" style={{ top: pathHeight * 0.55 }} />
      <TreeIcon className="absolute left-[4%] w-6 opacity-50" style={{ top: pathHeight * 0.78 }} />

      {/* Start platform */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5" style={{ top: 0 }}>
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-dark shadow-glow">
          <GummyMascot animate className="absolute bottom-0.5 h-[46px] w-10" />
        </div>
        <div className="relative rounded-md bg-[#B27A42] px-2.5 py-1 text-center shadow-subtle after:absolute after:left-2 after:-bottom-1.5 after:h-2 after:w-1.5 after:rounded-sm after:bg-[#8A5A2C]">
          <p className="text-[7px] font-bold tracking-widest text-[#FBE9CF]/85">START</p>
          <p className="font-display text-[11px] font-semibold text-white">Growth Journey</p>
        </div>
      </div>

      {laidOut.map((item, i) => {
        if (item.kind === 'banner') {
          return (
            <div
              key={`banner-${item.phase.key}`}
              className={cn(
                'absolute left-1/2 flex w-64 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-xl px-3.5 py-2.5 shadow-press motion-safe:animate-fade-in-up',
                item.phaseStatus === 'locked' ? 'bg-muted text-muted-foreground shadow-none' : 'bg-primary text-primary-foreground',
              )}
              style={{ top: item.y, animationDelay: `${i * 60}ms` }}
            >
              <span className="text-lg leading-none">{item.phaseStatus === 'locked' ? <Lock className="h-4 w-4" /> : item.phaseStatus === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}</span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Phase {item.phase.order} of {GROWTH_PHASE_DEFS.length}</p>
                <p className="truncate text-sm font-extrabold">{item.phase.title}</p>
              </div>
            </div>
          )
        }

        const { stage, x, y } = item
        const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
        return (
          <div key={stage.key}>
            <div
              className="pointer-events-none absolute h-6 w-[68px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_20%,#7BC24A,#4E9C2E_85%)]"
              style={{ top: y + 20, left: `${x}%` }}
            />
            <div
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center motion-safe:animate-fade-in-up"
              style={{ top: y, left: `${x}%`, animationDelay: `${i * 60}ms` }}
            >
              {stage.status === 'current' && (
                <div className="relative mb-1.5 rounded-lg border-2 border-border bg-card px-2.5 py-1 text-[10px] font-bold text-foreground shadow-popover">
                  Continue
                  <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-border bg-card" />
                </div>
              )}
              <div
                className={cn(
                  'flex h-[60px] w-[60px] items-center justify-center rounded-full border-4 transition-transform duration-200 hover:scale-105 active:scale-95',
                  stage.status === 'done' && 'border-primary-tint bg-primary text-primary-foreground',
                  stage.status === 'current' && 'border-primary-tint bg-primary text-primary-foreground motion-safe:animate-glow-pulse',
                  stage.status === 'locked' && 'border-border bg-card text-muted-foreground',
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <p className={cn('mt-1.5 max-w-[11rem] text-center text-sm font-bold leading-tight', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
                {stage.order}. {stage.title}
              </p>
              <p className="mt-0.5 max-w-[11rem] text-center text-[11px] leading-snug text-muted-foreground">{stage.description}</p>
              {stage.status === 'current' && canWrite && (
                <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="mt-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-press-sm transition-transform active:translate-y-[1px] active:shadow-none">
                  Start Mission →
                </Link>
              )}
              {stage.status === 'done' && (
                <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Review
                </Link>
              )}
            </div>
          </div>
        )
      })}

      {/* Trophy finish */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center" style={{ top: pathHeight - BOTTOM_PAD }}>
        <TrophyIcon className="h-14 w-14 drop-shadow" />
        <p className="text-[7px] font-bold tracking-widest text-warning">GROWTH MASTER</p>
      </div>
    </div>
  )
}

export default async function ClientGrowthPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [progress, stages, missions, weeklyCount, achievements] = await Promise.all([
    getGrowthProgress(ctx, clientId),
    getStageStates(ctx, clientId),
    getQuestBoard(ctx, clientId),
    getWeeklyMissionCompletionCount(ctx, clientId),
    listAchievements(ctx, clientId),
  ])

  const xp = progress?.xp ?? 0
  const level = progress?.level ?? 1
  const streak = progress?.streakCount ?? 0
  const canWrite = ctx.permissions.has('growth.write')
  // Sidebar summary: up to 3 unfinished quests, ready-to-claim first. Claiming
  // and logging happen on the Quests page only.
  const openQuests = missions
    .filter((q) => !q.completedAt)
    .sort((a, b) => Number(b.claimable) - Number(a.claimable))
    .slice(0, 3)
  const mapTheme = progress?.equippedMapTheme ? MAP_THEME_CLASSES[progress.equippedMapTheme] : undefined

  const stagesByKey = new Map(stages.map((s) => [s.key, s]))
  const stageStatusByKey = new Map(stages.map((s) => [s.key, s.status]))
  const phases: PhaseData[] = GROWTH_PHASE_DEFS.map((phase) => ({
    phase,
    status: phaseStatus(phase, stageStatusByKey),
    stages: phase.stageKeys.map((key) => stagesByKey.get(key)!),
  }))
  const allDone = phases.every((p) => p.status === 'done')

  return (
    <GummyStyleProvider value={cosmeticsFor(progress)}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Trophy} label="Level" value={String(level)} sub={`${xpToNextLevel(xp)} XP to level ${level + 1}`} />
            <StatCard icon={Zap} label="XP" value={xp.toLocaleString()} />
            <StatCard icon={Flame} label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub={streak > 0 ? 'Keep it going!' : 'Complete a stage to start'} />
          </div>

          <Card className={cn('overflow-hidden', mapTheme)}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <GummyMascot className="h-8 w-7 shrink-0" />
                <CardTitle>Marketing Growth Map</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">Complete missions. Earn XP. Grow your business.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <GrowthRoadmap phases={phases} clientId={clientId} canWrite={canWrite} />

              {allDone && (
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-bg px-3.5 py-2.5 text-sm font-semibold text-warning">
                  <Trophy className="h-4 w-4 shrink-0" /> Growth Master - every phase complete!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-primary/25 bg-primary-tint/40">
            <CardContent className="flex items-center gap-3 p-4">
              <GummyMascot className="h-14 w-12 shrink-0" />
              <p className="text-sm font-semibold text-primary">Small actions. Big results. Let&apos;s grow together!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Quests</CardTitle>
              <Link href={`/dashboard/clients/${clientId}/quests`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {openQuests.length === 0 && <p className="text-sm text-muted-foreground">You&apos;re all caught up - nice work!</p>}
              {openQuests.map((q) => (
                <Link key={q.key} href={`/dashboard/clients/${clientId}/quests${q.cadence === 'DAILY' ? '' : `?tab=${q.cadence.toLowerCase()}`}`} className="block space-y-1.5 rounded-xl p-1 hover:bg-muted">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{q.title}</p>
                    <span className="shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">+{q.xpReward} XP</span>
                  </div>
                  <ProgressBar value={q.progressCount} max={q.targetCount} />
                  <p className={cn('text-xs', q.claimable ? 'font-semibold text-success' : 'text-muted-foreground')}>
                    {q.claimable ? 'Ready to claim!' : `${q.progressCount}/${q.targetCount}`}
                  </p>
                </Link>
              ))}
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                {weeklyCount} quest{weeklyCount === 1 ? '' : 's'} completed this week.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {achievements.map((a) => (
                  <div key={a.key} className="flex flex-col items-center gap-1.5 text-center" title={a.description}>
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                        a.unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {a.unlocked ? <Target className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <p className="text-xs font-medium leading-tight text-foreground">{a.title}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GummyStyleProvider>
  )
}
