import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Dumbbell, Lock, Target } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getStageStates } from '@/lib/growth/stages'
import { getLessonForStage } from '@/lib/growth/lesson-defs'
import { getGrowthProgress } from '@/lib/growth/progress'
import { cosmeticsFor } from '@/lib/growth/shop-catalog'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { GummyCoach } from '@/components/growth/mascot'
import { cn } from '@/lib/utils'

/**
 * Practice (docs/DECISIONS.md 2026-09-26): replay any Growth Map lesson
 * you've reached, as often as you like. It opens the same lesson route as
 * the map - a finished stage plays in review mode (no second XP award;
 * the lesson page and `completeStage` already enforce that), the current
 * stage plays for real. Locked stages are shown but aren't links.
 */
export default async function PracticePage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [stages, progress] = await Promise.all([getStageStates(ctx, clientId), getGrowthProgress(ctx, clientId)])
  const reached = stages.filter((s) => s.status !== 'locked')
  const done = stages.filter((s) => s.status === 'done').length

  return (
    <GummyStyleProvider value={cosmeticsFor(progress)}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Practice</h1>
            <p className="mt-1 text-muted-foreground">Sharpen your marketing skills - replay any lesson you&apos;ve unlocked.</p>
          </div>
          <GummyCoach mood="thinking" mascotClassName="h-20 w-16" tone="tint" className="sm:max-w-sm">
            {done === 0 ? 'Finish your first Growth Map stage and it shows up here to practise.' : `You've mastered ${done} of ${stages.length} stages. Practice keeps them fresh!`}
          </GummyCoach>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stages.map((stage) => {
            const lesson = stage.key === 'DEFINE_BUSINESS' ? null : getLessonForStage(stage.key)
            const locked = stage.status === 'locked'
            const href = `/dashboard/clients/${clientId}/growth/lesson/${stage.key}`
            const Icon = stage.status === 'done' ? Check : stage.status === 'current' ? Target : Lock
            const body = (
              <>
                <span
                  className={cn(
                    'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-white',
                    locked ? 'bg-gradient-to-b from-[#E4E6EA] to-[#B9BEC6] text-[#5E6470] shadow-[0_4px_0_#9AA0A9]' : 'bg-gradient-to-b from-[#F4555A] to-[#D0151B] text-white shadow-[0_4px_0_#9A0F14]',
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-6 w-6" strokeWidth={stage.status === 'done' ? 4 : 2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold uppercase tracking-wide text-primary">Stage {stage.order}</span>
                  <span className={cn('block font-display text-lg font-bold leading-tight', locked ? 'text-muted-foreground' : 'text-foreground')}>{stage.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {stage.key === 'DEFINE_BUSINESS' ? 'Business profile form' : `${lesson?.questions.length ?? 0} questions`}
                    {' · '}
                    {stage.status === 'done' ? 'Completed' : stage.status === 'current' ? 'Up next' : 'Locked'}
                  </span>
                </span>
                {!locked && (
                  <span className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow-[0_3px_0_#9A0F14]">
                    {stage.status === 'done' ? 'Practice' : 'Start'}
                  </span>
                )}
              </>
            )
            return (
              <li key={stage.key}>
                {locked ? (
                  <div className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-border bg-muted/40 p-4" aria-label={`${stage.title} - locked`}>
                    {body}
                  </div>
                ) : (
                  <Link href={href} className="flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary-tint/30">
                    {body}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>

        {reached.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Dumbbell className="h-4 w-4" aria-hidden="true" /> Nothing to practise yet.
          </p>
        )}
      </div>
    </GummyStyleProvider>
  )
}
