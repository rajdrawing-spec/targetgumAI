import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Flame, Lock, Target, Zap } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, xpToNextLevel } from '@/lib/growth/progress'
import { getStageStates } from '@/lib/growth/stages'
import { getMissionProgress, getWeeklyMissionCompletionCount } from '@/lib/growth/missions'
import { listAchievements } from '@/lib/growth/achievements'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GummyMascot } from '@/components/growth/mascot'
import { CloudIcon, RockIcon, TreeIcon, TrophyIcon } from '@/components/growth/scenery'
import { recordMissionProgressAction } from './actions'

/**
 * Growth Map - the guided-onboarding wizard tab (docs/DECISIONS.md
 * 2026-09-22). Additive: this is one more Client Workspace tab, not a
 * replacement for anything else in the dashboard. Visually matches the
 * approved Duolingo-style mockup (mascot, winding illustrated path,
 * wooden signposts) rather than a generic settings-page look. "Log
 * progress" on a mission is a manual stand-in for real integration hooks
 * (e.g. Audience Lab auto-reporting a found segment) - wiring those is a
 * later step; for now a person marks progress themselves.
 *
 * The path's curve is computed server-side from fixed, hand-tuned
 * waypoints (STAGE_PATH_X below) - not measured from the live DOM. That
 * keeps it a plain server-rendered SVG with no client JS, at the cost of
 * the curve being a fixed shape rather than one that re-flows around
 * variable text height; below the `sm` breakpoint the illustrated path is
 * swapped for a plain stacked list (PlainStageList) so nothing overlaps
 * on narrow screens.
 */

const STEP = 168 // px between stage rows
const TOP_PAD = 210 // room for the start platform (mascot + signpost)
const BOTTOM_PAD = 150 // room for the trophy
// One x position (0-100, i.e. %) per stage, hand-tuned to echo the mockup's zigzag.
const STAGE_PATH_X = [18, 74, 24, 76, 20, 72, 18, 74, 22, 50]

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

/** Narrow-screen fallback - a plain stacked list, so nothing overlaps below the illustrated path's `sm` breakpoint. */
function PlainStageList({ stages, clientId, canWrite }: { stages: StageState[]; clientId: string; canWrite: boolean }) {
  return (
    <ol className="space-y-2 sm:hidden">
      {stages.map((stage) => {
        const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
        return (
          <li
            key={stage.key}
            className={cn('flex items-center gap-3 rounded-lg border px-3 py-3', stage.status === 'current' ? 'border-primary/40 bg-primary-tint/40' : 'border-border')}
          >
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', stage.status === 'locked' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
                {stage.order}. {stage.title}
              </p>
              <p className="text-xs text-muted-foreground">{stage.description}</p>
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
      })}
    </ol>
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

  const pathHeight = TOP_PAD + stages.length * STEP + BOTTOM_PAD
  const wayPoints = [
    { x: 50, y: TOP_PAD * 0.6 },
    ...stages.map((_, i) => ({ x: STAGE_PATH_X[i] ?? 50, y: TOP_PAD + i * STEP })),
    { x: 50, y: pathHeight - BOTTOM_PAD * 0.5 },
  ]
  const pathD = quadraticPath(wayPoints)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={TrophyIcon} label="Level" value={String(level)} sub={`${xpToNextLevel(xp)} XP to level ${level + 1}`} />
          <StatCard icon={Zap} label="XP" value={xp.toLocaleString()} />
          <StatCard icon={Flame} label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub={streak > 0 ? 'Keep it going!' : 'Complete a stage to start'} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Marketing Growth Map</CardTitle>
            <p className="text-sm text-muted-foreground">Complete missions. Earn XP. Grow your business.</p>
          </CardHeader>
          <CardContent>
            {/* Illustrated winding path - sm and up. */}
            <div className="relative mx-auto hidden max-w-2xl sm:block" style={{ height: pathHeight }}>
              <svg viewBox={`0 0 100 ${pathHeight}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                <path d={pathD} fill="none" stroke="hsl(var(--primary) / 0.28)" strokeWidth="0.6" strokeDasharray="1.4 2.2" strokeLinecap="round" />
              </svg>

              {/* Decorative scenery - sparse, purely ornamental. */}
              <TreeIcon className="absolute left-[8%] w-8 opacity-60" style={{ top: TOP_PAD + STEP * 0.6 }} />
              <RockIcon className="absolute left-[92%] w-7 opacity-50" style={{ top: TOP_PAD + STEP * 2.4 }} />
              <CloudIcon className="absolute left-[4%] w-16 opacity-70" style={{ top: TOP_PAD + STEP * 4.2 }} />
              <TreeIcon className="absolute left-[90%] w-7 opacity-60" style={{ top: TOP_PAD + STEP * 6.3 }} />
              <RockIcon className="absolute left-[6%] w-7 opacity-50" style={{ top: TOP_PAD + STEP * 8.1 }} />

              {/* Start platform */}
              <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2" style={{ top: 0 }}>
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-dark shadow-glow">
                  <GummyMascot animate className="absolute bottom-1 h-16 w-14" />
                </div>
                <div className="relative rounded-md bg-[#B27A42] px-4 py-1.5 text-center shadow-subtle after:absolute after:left-3 after:-bottom-2.5 after:h-3 after:w-1.5 after:rounded-sm after:bg-[#8A5A2C]">
                  <p className="text-[9px] font-bold tracking-widest text-[#FBE9CF]/85">START</p>
                  <p className="font-display text-sm font-semibold text-white">Your Growth Journey</p>
                </div>
              </div>

              {stages.map((stage, i) => {
                const x = STAGE_PATH_X[i] ?? 50
                const y = TOP_PAD + i * STEP
                const onRight = x <= 50
                const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
                return (
                  <div key={stage.key}>
                    {/* Island mound, centered under the node at (x%, y). */}
                    <div
                      className="pointer-events-none absolute h-6 w-[70px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_20%,#7BC24A,#4E9C2E_85%)]"
                      style={{ top: y + 22, left: `${x}%` }}
                    />
                    {/* Node circle, centered exactly on the path at (x%, y). */}
                    <div
                      className={cn(
                        'absolute flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4',
                        stage.status === 'done' && 'border-primary-tint bg-primary text-primary-foreground',
                        stage.status === 'current' && 'border-primary-tint bg-primary text-primary-foreground motion-safe:animate-glow-pulse',
                        stage.status === 'locked' && 'border-border bg-card text-muted-foreground',
                      )}
                      style={{ top: y, left: `${x}%` }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    {/* Label, offset from the same (x%, y) anchor via calc() - never nested inside the circle's own box. */}
                    <div
                      className={cn('absolute w-56 -translate-y-1/2', onRight ? 'text-left' : 'text-right')}
                      style={{ top: y, ...(onRight ? { left: `calc(${x}% + 42px)` } : { right: `calc(${100 - x}% + 42px)` }) }}
                    >
                      <p className={cn('text-sm font-bold', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
                        {stage.order}. {stage.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                      {stage.status === 'current' && canWrite && (
                        <div className={cn('mt-1.5', !onRight && 'flex justify-end')}>
                          <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className={buttonVariants({ size: 'sm' })}>
                            Start lesson
                          </Link>
                        </div>
                      )}
                      {stage.status === 'done' && (
                        <div className={cn('mt-1', !onRight && 'flex justify-end')}>
                          <Link href={`/dashboard/clients/${clientId}/growth/lesson/${stage.key}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                            Review lesson
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Trophy finish */}
              <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-center" style={{ top: pathHeight - BOTTOM_PAD }}>
                <TrophyIcon className="h-20 w-20 drop-shadow" />
                <p className="text-[9px] font-bold tracking-widest text-warning">GROWTH MASTER</p>
              </div>
            </div>

            <PlainStageList stages={stages} clientId={clientId} canWrite={canWrite} />
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
