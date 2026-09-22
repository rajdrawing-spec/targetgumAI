import { redirect } from 'next/navigation'
import { CheckCircle2, Flame, Lock, Target, Trophy, Zap } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getGrowthProgress, xpToNextLevel } from '@/lib/growth/progress'
import { getStageStates } from '@/lib/growth/stages'
import { getMissionProgress, getWeeklyMissionCompletionCount } from '@/lib/growth/missions'
import { listAchievements } from '@/lib/growth/achievements'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { cn } from '@/lib/utils'
import { completeStageAction, recordMissionProgressAction } from './actions'

/**
 * Growth Map - the guided-onboarding wizard tab (docs/DECISIONS.md
 * 2026-09-22). Additive: this is one more Client Workspace tab, not a
 * replacement for anything else in the dashboard. "Log progress" on a
 * mission is a manual stand-in for real integration hooks (e.g. Audience
 * Lab auto-reporting a found segment) - wiring those is a later step; for
 * now a person marks progress themselves.
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
  const currentStage = stages.find((s) => s.status === 'current')

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
            <CardTitle>Marketing Growth Map</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Complete stages in order. Each one unlocks the next and awards XP.</p>
            <ol className="space-y-2">
              {stages.map((stage) => {
                const Icon = stage.status === 'done' ? CheckCircle2 : stage.status === 'current' ? Target : Lock
                return (
                  <li
                    key={stage.key}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-3',
                      stage.status === 'current' ? 'border-primary/40 bg-primary-tint/40' : 'border-border',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        stage.status === 'done' && 'bg-primary text-primary-foreground',
                        stage.status === 'current' && 'bg-primary text-primary-foreground',
                        stage.status === 'locked' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium', stage.status === 'locked' ? 'text-muted-foreground' : 'text-foreground')}>
                        {stage.order}. {stage.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                    </div>
                    {stage.status === 'current' && canWrite && (
                      <ActionForm action={completeStageAction.bind(null, clientId, stage.key)}>
                        <SubmitButton size="sm" pendingLabel="Completing…">
                          Complete stage
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
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
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">{weeklyCount} mission{weeklyCount === 1 ? '' : 's'} completed this week.</p>
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
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      a.unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {a.unlocked ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <p className="text-xs font-medium leading-tight text-foreground">{a.title}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {currentStage && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Up next: <span className="font-medium text-foreground">{currentStage.title}</span> — {currentStage.description}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
