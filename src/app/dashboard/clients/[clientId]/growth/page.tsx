import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, Check, CheckCircle2, ChevronDown, Flame, Lock, Target, Trophy, Zap } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, xpToNextLevel } from '@/lib/growth/progress'
import { getStageStates } from '@/lib/growth/stages'
import { getMissionProgress, getWeeklyMissionCompletionCount } from '@/lib/growth/missions'
import { listAchievements } from '@/lib/growth/achievements'
import { MISSION_SCREEN_LINKS } from '@/lib/growth/mission-links'
import { GROWTH_PHASE_DEFS, phaseStatus, type GrowthPhaseDef, type GrowthPhaseStatus } from '@/lib/growth/phase-defs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GummyMascot } from '@/components/growth/mascot'
import { CloudIcon, RockIcon, TreeIcon, TrophyIcon } from '@/components/growth/scenery'
import { recordMissionProgressAction } from './actions'

/**
 * Growth Map - the guided-onboarding wizard tab (docs/DECISIONS.md
 * 2026-09-22, restructured 2026-09-23 twice: first into a plain
 * collapsible phase list, then - per direct feedback wanting the
 * illustrated roadmap look back, just organized by phase - into the
 * `PhaseRoadmap` below). The 10 fixed stages are grouped into 4 phases;
 * the illustrated winding path now has one stop per PHASE (not one per
 * stage), so it stays short while keeping the mascot/path/trophy visual
 * identity. Each phase stop shows its 2-3 stages as a compact inline list
 * rather than the old full-size per-stage cards. Below `sm`, the path
 * doesn't have room to breathe, so it's swapped for `PhaseStepper` +
 * collapsible `PhaseSection`s (same phase data, plain-list format).
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

/** One compact, single-line stage row used inside a roadmap phase stop's label. */
function RoadmapStageRow({ stage, clientId, canWrite }: { stage: StageState; clientId: string; canWrite: boolean }) {
  const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3 w-3 shrink-0', stage.status === 'locked' ? 'text-muted-foreground' : 'text-primary')} />
      <span className={cn('truncate text-xs', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
        {stage.order}. {stage.title}
      </span>
      {stage.status === 'current' && canWrite && (
        <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="ml-auto shrink-0 text-xs font-semibold text-primary hover:underline">
          Start
        </Link>
      )}
      {stage.status === 'done' && (
        <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="ml-auto shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          Review
        </Link>
      )}
    </div>
  )
}

/**
 * Illustrated winding path, `sm` and up - one stop per phase (not per
 * stage), so 4 nodes instead of 10. Each phase stop's block height varies
 * with its stage count, so the vertical spacing is computed per-phase
 * rather than a fixed STEP - still plain server-side arithmetic, no
 * client JS or DOM measurement.
 */
function PhaseRoadmap({ phases, clientId, canWrite }: { phases: PhaseData[]; clientId: string; canWrite: boolean }) {
  const TOP_PAD = 150
  const BOTTOM_PAD = 110
  const GAP = 48
  const HEADER_H = 40
  const ROW_H = 20
  const BLOCK_PAD = 14
  const PHASE_PATH_X = [20, 76, 20, 50]

  let cumulative = TOP_PAD
  const blocks = phases.map((p, i) => {
    const blockHeight = HEADER_H + p.stages.length * ROW_H + BLOCK_PAD
    const y = cumulative + blockHeight / 2
    const x = PHASE_PATH_X[i] ?? 50
    cumulative += blockHeight + GAP
    return { ...p, x, y }
  })
  const pathHeight = cumulative - GAP + BOTTOM_PAD

  const wayPoints = [{ x: 50, y: TOP_PAD * 0.55 }, ...blocks.map((b) => ({ x: b.x, y: b.y })), { x: 50, y: pathHeight - BOTTOM_PAD * 0.5 }]
  const pathD = quadraticPath(wayPoints)

  return (
    <div className="relative mx-auto hidden max-w-2xl sm:block" style={{ height: pathHeight }}>
      <svg viewBox={`0 0 100 ${pathHeight}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path d={pathD} fill="none" stroke="hsl(var(--primary) / 0.28)" strokeWidth="0.6" strokeDasharray="1.4 2.2" strokeLinecap="round" />
      </svg>

      {/* Decorative scenery - sparse, purely ornamental. */}
      <TreeIcon className="absolute left-[6%] w-8 opacity-60" style={{ top: TOP_PAD * 0.35 }} />
      <CloudIcon className="absolute left-[86%] w-16 opacity-60" style={{ top: pathHeight * 0.38 }} />
      <RockIcon className="absolute left-[90%] w-7 opacity-50" style={{ top: pathHeight * 0.68 }} />

      {/* Start platform */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5" style={{ top: 0 }}>
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-dark shadow-glow">
          <GummyMascot animate className="absolute bottom-0.5 h-[52px] w-11" />
        </div>
        <div className="relative rounded-md bg-[#B27A42] px-3 py-1 text-center shadow-subtle after:absolute after:left-2.5 after:-bottom-2 after:h-2.5 after:w-1.5 after:rounded-sm after:bg-[#8A5A2C]">
          <p className="text-[8px] font-bold tracking-widest text-[#FBE9CF]/85">START</p>
          <p className="font-display text-xs font-semibold text-white">Your Growth Journey</p>
        </div>
      </div>

      {blocks.map(({ phase, status, stages, x, y }) => {
        const onRight = x <= 50
        return (
          <div key={phase.key}>
            {/* Island mound, centered under the node. */}
            <div
              className="pointer-events-none absolute h-7 w-20 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_20%,#7BC24A,#4E9C2E_85%)]"
              style={{ top: y + 26, left: `${x}%` }}
            />
            {/* Phase node. */}
            <div
              className={cn(
                'absolute flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4',
                status === 'done' && 'border-primary-tint bg-primary text-primary-foreground',
                status === 'current' && 'border-primary-tint bg-primary text-primary-foreground motion-safe:animate-glow-pulse',
                status === 'locked' && 'border-border bg-card text-muted-foreground',
              )}
              style={{ top: y, left: `${x}%` }}
            >
              {status === 'done' ? <CheckCircle2 className="h-6 w-6" /> : status === 'locked' ? <Lock className="h-6 w-6" /> : <Target className="h-6 w-6" />}
            </div>
            {/* Label, offset from the same (x%, y) anchor via calc(). */}
            <div
              className={cn('absolute w-60 -translate-y-1/2 space-y-1.5', onRight ? 'text-left' : 'text-right')}
              style={{ top: y, ...(onRight ? { left: `calc(${x}% + 44px)` } : { right: `calc(${100 - x}% + 44px)` }) }}
            >
              <div>
                <p className={cn('text-sm font-bold', status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
                  Phase {phase.order} · {phase.title}
                </p>
                <p className="text-xs text-muted-foreground">{phase.description}</p>
              </div>
              <div className="space-y-1 text-left">
                {stages.map((stage) => (
                  <RoadmapStageRow key={stage.key} stage={stage} clientId={clientId} canWrite={canWrite} />
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Trophy finish */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center" style={{ top: pathHeight - BOTTOM_PAD }}>
        <TrophyIcon className="h-16 w-16 drop-shadow" />
        <p className="text-[8px] font-bold tracking-widest text-warning">GROWTH MASTER</p>
      </div>
    </div>
  )
}

/** Horizontal Phase 1/2/3/4 overview strip above the mobile phase list. */
function PhaseStepper({ phases, statuses }: { phases: readonly GrowthPhaseDef[]; statuses: GrowthPhaseStatus[] }) {
  return (
    <div className="flex items-start px-1 sm:hidden">
      {phases.map((phase, i) => (
        <div key={phase.key} className={cn('flex items-center', i < phases.length - 1 && 'flex-1')}>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                statuses[i] === 'done' && 'bg-primary text-primary-foreground',
                statuses[i] === 'current' && 'bg-primary text-primary-foreground motion-safe:animate-glow-pulse',
                statuses[i] === 'locked' && 'bg-muted text-muted-foreground',
              )}
            >
              {statuses[i] === 'done' ? <Check className="h-4 w-4" /> : phase.order}
            </div>
            <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">Phase {phase.order}</span>
          </div>
          {i < phases.length - 1 && <div className={cn('mx-1.5 h-0.5 flex-1', statuses[i] === 'done' ? 'bg-primary' : 'bg-border')} />}
        </div>
      ))}
    </div>
  )
}

function StageRow({ stage, clientId, canWrite }: { stage: StageState; clientId: string; canWrite: boolean }) {
  const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5',
        stage.status === 'current' ? 'border-primary/40 bg-primary-tint/40' : 'border-border',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          stage.status === 'locked' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
          {stage.order}. {stage.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{stage.description}</p>
      </div>
      {stage.status === 'current' && canWrite && (
        <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className={buttonVariants({ size: 'sm' })}>
          Start lesson
        </Link>
      )}
      {stage.status === 'done' && (
        <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          Review
        </Link>
      )}
    </li>
  )
}

function PhaseSection({ phase, status, stages, clientId, canWrite }: PhaseData & { clientId: string; canWrite: boolean }) {
  const doneCount = stages.filter((s) => s.status === 'done').length
  return (
    <details className="group rounded-xl border border-border sm:hidden" open={status === 'current'}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              status === 'done' && 'bg-primary text-primary-foreground',
              status === 'current' && 'bg-primary text-primary-foreground',
              status === 'locked' && 'bg-muted text-muted-foreground',
            )}
          >
            {status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : status === 'locked' ? <Lock className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              Phase {phase.order} · {phase.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{phase.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount}/{stages.length}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <ol className="space-y-2 border-t border-border p-3">
        {stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} clientId={clientId} canWrite={canWrite} />
        ))}
      </ol>
    </details>
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <GummyMascot className="h-8 w-7 shrink-0" />
              <CardTitle>Marketing Growth Map</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Complete missions. Earn XP. Grow your business.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <PhaseRoadmap phases={phases} clientId={clientId} canWrite={canWrite} />

            <PhaseStepper phases={GROWTH_PHASE_DEFS} statuses={phases.map((p) => p.status)} />
            <div className="space-y-2.5 sm:hidden">
              {phases.map((p) => (
                <PhaseSection key={p.phase.key} {...p} clientId={clientId} canWrite={canWrite} />
              ))}
            </div>

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
