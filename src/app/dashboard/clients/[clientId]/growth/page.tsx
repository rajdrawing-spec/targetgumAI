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
import { recordMissionProgressAction } from './actions'

/**
 * Growth Map - the guided-onboarding wizard tab (docs/DECISIONS.md
 * 2026-09-22, restructured 2026-09-23). The 10 fixed stages are grouped
 * into 4 named phases so the page reads as a short, scannable list rather
 * than one long illustrated path - only the phase holding the client's
 * current stage opens by default; earlier phases collapse to a completed
 * summary row and later ones stay collapsed until reached. Plain <details>/
 * <summary>, no client JS needed for the expand/collapse.
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

/** Horizontal Phase 1/2/3/4 overview strip at the top of the map card. */
function PhaseStepper({ phases, statuses }: { phases: readonly GrowthPhaseDef[]; statuses: GrowthPhaseStatus[] }) {
  return (
    <div className="flex items-start px-1">
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

function PhaseSection({
  phase,
  status,
  stages,
  clientId,
  canWrite,
}: {
  phase: GrowthPhaseDef
  status: GrowthPhaseStatus
  stages: StageState[]
  clientId: string
  canWrite: boolean
}) {
  const doneCount = stages.filter((s) => s.status === 'done').length
  return (
    <details className="group rounded-xl border border-border" open={status === 'current'}>
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
  const phases = GROWTH_PHASE_DEFS.map((phase) => ({
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GummyMascot className="h-8 w-7 shrink-0" />
              <CardTitle>Marketing Growth Map</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Complete missions. Earn XP. Grow your business.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <PhaseStepper phases={GROWTH_PHASE_DEFS} statuses={phases.map((p) => p.status)} />

            <div className="space-y-2.5">
              {phases.map(({ phase, status, stages: phaseStages }) => (
                <PhaseSection key={phase.key} phase={phase} status={status} stages={phaseStages} clientId={clientId} canWrite={canWrite} />
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
