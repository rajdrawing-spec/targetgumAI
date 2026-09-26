import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getStageStates, STAGE_XP_REWARD } from '@/lib/growth/stages'
import { getGrowthProgress } from '@/lib/growth/progress'
import { STAGE_BRIDGES } from '@/lib/growth/stage-bridges'
import { cosmeticsFor } from '@/lib/growth/shop-catalog'
import { GummyStyleProvider } from '@/components/growth/gummy-style'
import { GROWTH_STAGE_ORDER } from '@/lib/growth/stage-defs'
import { getLessonForStage } from '@/lib/growth/lesson-defs'
import { getClientBrainSection } from '@/lib/clients/brain'
import type { BusinessSectionSchema } from '@/lib/clients/brain-schemas'
import type { z } from 'zod'
import { LessonQuiz } from '@/components/growth/lesson-quiz'
import { BusinessIntakeForm } from '@/components/growth/business-intake-form'
import { completeStageAction, completeBusinessIntakeAction } from '../../actions'
import type { GrowthStageKey } from '@prisma/client'

type Business = z.infer<typeof BusinessSectionSchema>

/**
 * A single Growth Map stage's lesson - the Duolingo-style quiz mechanic
 * (docs/DECISIONS.md). Reached from the map by clicking a stage's "Start
 * lesson" link. Stage completion (and its XP award) still goes through the
 * same `completeStage` lib function/permission check as before - this page
 * only adds an interactive lesson in front of that existing action, it
 * doesn't introduce a new way to mutate stage state.
 */
export default async function GrowthLessonPage({
  params,
}: {
  params: Promise<{ clientId: string; stage: string }>
}) {
  const [{ clientId, stage: stageParam }, ctx] = await Promise.all([
    params,
    getCurrentAuthContext(),
  ])
  if (!ctx) redirect('/sign-in')

  if (!GROWTH_STAGE_ORDER.includes(stageParam as GrowthStageKey)) notFound()
  const stage = stageParam as GrowthStageKey

  const stages = await getStageStates(ctx, clientId)
  const stageState = stages.find((s) => s.key === stage)
  if (!stageState) notFound()
  if (stageState.status === 'locked') redirect(`/dashboard/clients/${clientId}/growth`)

  const canWrite = ctx.permissions.has('growth.write')
  const alreadyCompleted = stageState.status === 'done'

  const crumb = (
    <Link
      href={`/dashboard/clients/${clientId}/growth`}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" /> Growth Map
    </Link>
  )

  if (stage === 'DEFINE_BUSINESS') {
    const business = ((await getClientBrainSection(ctx, clientId, 'business')) ?? {}) as Business
    return (
      <div className="space-y-5">
        {crumb}
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Stage {stageState.order} of {GROWTH_STAGE_ORDER.length}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            Define Your Business
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Before we can help you market, we need to understand your business - in plain, everyday
            words.
          </p>
        </div>
        <BusinessIntakeForm
          business={business}
          completeAction={completeBusinessIntakeAction.bind(null, clientId)}
          canWrite={canWrite}
          alreadyCompleted={alreadyCompleted}
        />
      </div>
    )
  }

  const lesson = getLessonForStage(stage)
  if (!lesson) notFound()
  const completeAction =
    !alreadyCompleted && canWrite ? completeStageAction.bind(null, clientId, stage) : null
  const progress = await getGrowthProgress(ctx, clientId)
  const bridge = STAGE_BRIDGES[stage]

  // Full-screen lesson per the reference (logo, progress, hearts, Exit
  // Lesson on top; SKIP/CHECK footer): a fixed layer over the workspace
  // chrome, so the route - and every permission check on it - is unchanged.
  return (
    <GummyStyleProvider value={cosmeticsFor(progress)}>
      <div className="fixed inset-0 z-[60] !mt-0 overflow-y-auto bg-background">
        <LessonQuiz
          lesson={lesson}
          clientId={clientId}
          xpReward={STAGE_XP_REWARD}
          completeAction={completeAction}
          alreadyCompleted={alreadyCompleted}
          streakCount={progress?.streakCount ?? 0}
          bridge={{ label: bridge.label, href: bridge.href(clientId) }}
        />
      </div>
    </GummyStyleProvider>
  )
}
