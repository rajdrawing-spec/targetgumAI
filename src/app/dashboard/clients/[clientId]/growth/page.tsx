import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Flame, Lock, Target, Trophy, Zap } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, xpToNextLevel } from '@/lib/growth/progress'
import { getStageStates } from '@/lib/growth/stages'
import { getMissionProgress, getWeeklyMissionCompletionCount } from '@/lib/growth/missions'
import { listAchievements } from '@/lib/growth/achievements'
import { MISSION_SCREEN_LINKS } from '@/lib/growth/mission-links'
import { GROWTH_PHASE_DEFS, phaseStatus, type GrowthPhaseDef, type GrowthPhaseStatus } from '@/lib/growth/phase-defs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { cn } from '@/lib/utils'
import { GummyMascot } from '@/components/growth/mascot'
import { CloudIcon, RockIcon, TreeIcon, TrophyIcon } from '@/components/growth/scenery'
import { recordMissionProgressAction } from './actions'

/**
 * Growth Map - the guided-onboarding wizard tab (docs/DECISIONS.md
 * 2026-09-22, restructured 2026-09-23 three times: plain collapsible list
 * -> a wide illustrated path with one stop per phase -> this version).
 * Direct feedback on round three: match real Duolingo's actual pattern
 * (narrow centered path, colored "unit" banner, compact nodes, no
 * separate mobile layout) rather than a wide desktop-only zigzag with a
 * completely different mobile fallback. `PhaseRoadmap` is now ONE
 * component/markup at every viewport width - it's narrow (`max-w-xs`) by
 * design, so it reads the same on a phone and centered inside the desktop
 * card, with no `sm:` branching anywhere in this file.
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

/** One compact, centered stage row inside a phase node's stack. */
function RoadmapStageRow({ stage, clientId, canWrite }: { stage: StageState; clientId: string; canWrite: boolean }) {
  const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs">
      <Icon className={cn('h-3 w-3 shrink-0', stage.status === 'locked' ? 'text-muted-foreground' : 'text-primary')} />
      <span className={cn('truncate', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
        {stage.order}. {stage.title}
      </span>
      {stage.status === 'current' && canWrite && (
        <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="shrink-0 font-semibold text-primary hover:underline">
          Start
        </Link>
      )}
      {stage.status === 'done' && (
        <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="shrink-0 font-medium text-muted-foreground hover:text-foreground">
          Review
        </Link>
      )}
    </div>
  )
}

/**
 * A narrow, centered winding path - the same markup at any viewport
 * width. Each phase is one node (so 4 stops, not 10) with a short caption
 * and its 2-3 stages listed compactly beneath, all centered on the node's
 * own x position rather than anchored left/right - that's what lets one
 * layout serve mobile and desktop identically. Node heights vary with
 * stage count, so vertical spacing is computed per-phase; still plain
 * server-side arithmetic, no client JS or DOM measurement.
 */
function PhaseRoadmap({ phases, clientId, canWrite }: { phases: PhaseData[]; clientId: string; canWrite: boolean }) {
  const TOP_PAD = 120
  const BOTTOM_PAD = 100
  const GAP = 42
  const NODE_D = 64
  const CAPTION_H = 36 // "Phase N · Title" reliably wraps to 2 lines at this column width
  const ROW_H = 20
  const BLOCK_PAD = 14
  const CONTINUE_BUBBLE_H = 34 // extra room for the "Continue" callout above the current phase's node
  const PHASE_X = [36, 64, 36, 50] // gentle wobble, narrow - reads the same at any container width

  let cumulative = TOP_PAD
  const blocks = phases.map((p, i) => {
    const stackHeight = NODE_D + CAPTION_H + p.stages.length * ROW_H + BLOCK_PAD + (p.status === 'current' ? CONTINUE_BUBBLE_H : 0)
    const y = cumulative + stackHeight / 2
    const x = PHASE_X[i] ?? 50
    cumulative += stackHeight + GAP
    return { ...p, x, y }
  })
  const pathHeight = cumulative - GAP + BOTTOM_PAD

  const wayPoints = [{ x: 50, y: TOP_PAD * 0.5 }, ...blocks.map((b) => ({ x: b.x, y: b.y })), { x: 50, y: pathHeight - BOTTOM_PAD * 0.5 }]
  const pathD = quadraticPath(wayPoints)

  return (
    <div className="relative mx-auto max-w-xs" style={{ height: pathHeight }}>
      <svg viewBox={`0 0 100 ${pathHeight}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path d={pathD} fill="none" stroke="hsl(var(--primary) / 0.28)" strokeWidth="0.7" strokeDasharray="1.6 2.4" strokeLinecap="round" />
      </svg>

      {/* Decorative scenery - sparse, purely ornamental. */}
      <TreeIcon className="absolute left-[4%] w-7 opacity-60" style={{ top: TOP_PAD * 0.3 }} />
      <CloudIcon className="absolute left-[80%] w-14 opacity-60" style={{ top: pathHeight * 0.4 }} />
      <RockIcon className="absolute left-[84%] w-6 opacity-50" style={{ top: pathHeight * 0.7 }} />

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

      {blocks.map(({ phase, status, stages, x, y }, i) => (
        <div
          key={phase.key}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center motion-safe:animate-fade-in-up"
          style={{ top: y, left: `${x}%`, animationDelay: `${i * 90}ms` }}
        >
          {status === 'current' && (
            <div className="relative mb-1.5 rounded-lg border-2 border-border bg-card px-2.5 py-1 text-[10px] font-bold text-foreground shadow-popover">
              Continue
              <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-border bg-card" />
            </div>
          )}
          <div
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full border-4 transition-transform duration-200 hover:scale-105 active:scale-95',
              status === 'done' && 'border-primary-tint bg-primary text-primary-foreground',
              status === 'current' && 'border-primary-tint bg-primary text-primary-foreground motion-safe:animate-glow-pulse',
              status === 'locked' && 'border-border bg-card text-muted-foreground',
            )}
          >
            {status === 'done' ? <CheckCircle2 className="h-6 w-6" /> : status === 'locked' ? <Lock className="h-6 w-6" /> : <Target className="h-6 w-6" />}
          </div>
          <p className={cn('mt-1.5 max-w-[9.5rem] text-center text-xs font-bold leading-tight', status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
            Phase {phase.order} · {phase.title}
          </p>
          <div className="mt-1 w-44 space-y-1">
            {stages.map((stage) => (
              <RoadmapStageRow key={stage.key} stage={stage} clientId={clientId} canWrite={canWrite} />
            ))}
          </div>
        </div>
      ))}

      {/* Trophy finish */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center" style={{ top: pathHeight - BOTTOM_PAD }}>
        <TrophyIcon className="h-14 w-14 drop-shadow" />
        <p className="text-[7px] font-bold tracking-widest text-warning">GROWTH MASTER</p>
      </div>
    </div>
  )
}

/** Duolingo-style colored "unit" banner naming the client's current phase. */
function CurrentPhaseBanner({ phases }: { phases: PhaseData[] }) {
  const current = phases.find((p) => p.status === 'current') ?? phases[phases.length - 1]!
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-press">
      <GummyMascot className="h-10 w-9 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">
          Phase {current.phase.order} of {GROWTH_PHASE_DEFS.length}
        </p>
        <p className="truncate font-display text-base font-extrabold">{current.phase.title}</p>
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
    getMissionProgress(ctx, clientId),
    getWeeklyMissionCompletionCount(ctx, clientId),
    listAchievements(ctx, clientId),
  ])

  const xp = progress?.xp ?? 0
  const level = progress?.level ?? 1
  const streak = progress?.streakCount ?? 0
  const canWrite = ctx.permissions.has('growth.write')

  const stagesByKey = new Map(stages.map((s) => [s.key, s]))
  const stageStatusByKey = new Map(stages.map((s) => [s.key, s.status]))
  const phases: PhaseData[] = GROWTH_PHASE_DEFS.map((phase) => ({
    phase,
    status: phaseStatus(phase, stageStatusByKey),
    stages: phase.stageKeys.map((key) => stagesByKey.get(key)!),
  }))
  const allDone = phases.every((p) => p.status === 'done')

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={Trophy} label="Level" value={String(level)} sub={`${xpToNextLevel(xp)} XP to level ${level + 1}`} />
          <StatCard icon={Zap} label="XP" value={xp.toLocaleString()} />
          <StatCard icon={Flame} label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub={streak > 0 ? 'Keep it going!' : 'Complete a stage to start'} />
        </div>

        <Card className="overflow-hidden">
          <CardContent className="space-y-4">
            <CurrentPhaseBanner phases={phases} />
            <PhaseRoadmap phases={phases} clientId={clientId} canWrite={canWrite} />

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
          <CardHeader>
            <CardTitle>Missions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {missions.length === 0 && <p className="text-sm text-muted-foreground">No missions available right now.</p>}
            {missions.map(({ mission, progressCount, completedAt }) => (
              <div key={mission.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{mission.title}</p>
                    <p className="text-xs text-muted-foreground">{mission.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">+{mission.xpReward} XP</span>
                </div>
                {MISSION_SCREEN_LINKS[mission.key] && (
                  <Link
                    href={MISSION_SCREEN_LINKS[mission.key]!.href(clientId)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {MISSION_SCREEN_LINKS[mission.key]!.label} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                <ProgressBar value={progressCount} max={mission.targetCount} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {progressCount}/{mission.targetCount}
                  </span>
                  {completedAt ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </span>
                  ) : (
                    canWrite && (
                      <ActionForm action={recordMissionProgressAction.bind(null, clientId)}>
                        <input type="hidden" name="missionKey" value={mission.key} />
                        <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
                          Log progress
                        </SubmitButton>
                      </ActionForm>
                    )
                  )}
                </div>
              </div>
            ))}
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              {weeklyCount} mission{weeklyCount === 1 ? '' : 's'} completed this week.
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
  )
}
