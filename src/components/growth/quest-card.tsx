import Link from 'next/link'
import { BarChart3, BookOpen, Check, Link2, Map, Megaphone, Palette, Trophy, Users, type LucideIcon } from 'lucide-react'
import type { QuestCard as QuestCardData } from '@/lib/growth/quests'
import type { QuestDef } from '@/lib/growth/quest-defs'
import { MISSION_SCREEN_LINKS } from '@/lib/growth/mission-links'
import type { ActionResult } from '@/lib/actions/result'
import { ProgressBar } from '@/components/gamification/stats'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BoundAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>

const ICONS: Record<QuestDef['icon'], { icon: LucideIcon; tile: string }> = {
  audience: { icon: Users, tile: 'bg-warning-bg text-warning' },
  analytics: { icon: BarChart3, tile: 'bg-info-bg text-info' },
  creative: { icon: Palette, tile: 'bg-primary-tint text-primary' },
  lesson: { icon: BookOpen, tile: 'bg-success-bg text-success' },
  campaign: { icon: Megaphone, tile: 'bg-primary-tint text-primary' },
  integration: { icon: Link2, tile: 'bg-info-bg text-info' },
  map: { icon: Map, tile: 'bg-warning-bg text-mustard' },
  goal: { icon: Trophy, tile: 'bg-warning-bg text-mustard' },
}

/**
 * One quest row (reference: icon tile, title, progress, +XP, action).
 * The action depends on what the quest is:
 * - verified + target met  -> "Claim" (server recounts before awarding)
 * - verified + not yet     -> a link to where the real work happens
 * - self-reported (legacy) -> the original "log progress" button + link
 * Viewers without growth.write see progress only.
 */
export function QuestCard({
  quest,
  clientId,
  canWrite,
  claimAction,
  logAction,
}: {
  quest: QuestCardData
  clientId: string
  canWrite: boolean
  claimAction: BoundAction
  logAction: BoundAction
}) {
  const { icon: Icon, tile } = ICONS[quest.icon]
  const done = Boolean(quest.completedAt)

  return (
    <li className={cn('flex flex-col gap-4 rounded-3xl border-2 bg-card p-4 sm:flex-row sm:items-center sm:p-5', done ? 'border-success/30' : 'border-border')}>
      <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', tile)} aria-hidden="true">
        <Icon className="h-7 w-7" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold leading-tight text-foreground">{quest.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{quest.description}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar
            value={quest.progressCount}
            max={quest.targetCount}
            label={`${quest.title} progress`}
            tone={done ? 'success' : 'primary'}
            className="h-2.5 max-w-xs flex-1"
          />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {quest.progressCount} / {quest.targetCount}
          </span>
        </div>
        {!quest.verified && !done && <p className="mt-1.5 text-xs text-caption">Self-reported - log it when you&apos;ve done it.</p>}
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-40 sm:flex-col sm:items-end">
        <span className="font-display text-xl font-extrabold text-primary">+{quest.xpReward} XP</span>
        <QuestAction quest={quest} clientId={clientId} canWrite={canWrite} claimAction={claimAction} logAction={logAction} />
      </div>
    </li>
  )
}

/**
 * The right-hand action. Wherever a form can succeed into "Done", the
 * same ActionForm stays mounted and only its contents swap: the page
 * revalidates on success and flips the card, and unmounting the form at
 * that moment would swallow its success toast.
 */
function QuestAction({
  quest,
  clientId,
  canWrite,
  claimAction,
  logAction,
}: {
  quest: QuestCardData
  clientId: string
  canWrite: boolean
  claimAction: BoundAction
  logAction: BoundAction
}) {
  const done = Boolean(quest.completedAt)
  const link = MISSION_SCREEN_LINKS[quest.key]

  if (!canWrite) return done ? <DoneBadge /> : null

  if (quest.verified) {
    if (!quest.claimable && !done) {
      return link ? (
        <Link href={link.href(clientId)} className={cn(buttonVariants({ size: 'sm' }), 'min-w-28 uppercase tracking-wide')}>
          {quest.progressCount > 0 ? 'Continue' : 'Start'}
        </Link>
      ) : null
    }
    return (
      <ActionForm action={claimAction} fullReload>
        <input type="hidden" name="questKey" value={quest.key} />
        {done ? (
          <DoneBadge />
        ) : (
          <SubmitButton size="sm" className="min-w-28 uppercase tracking-wide" pendingLabel="Claiming…">
            Claim XP
          </SubmitButton>
        )}
      </ActionForm>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <ActionForm action={logAction} fullReload>
        <input type="hidden" name="missionKey" value={quest.key} />
        {done ? (
          <DoneBadge />
        ) : (
          <SubmitButton size="sm" variant="outline" className="min-w-28" pendingLabel="Saving…">
            Log progress
          </SubmitButton>
        )}
      </ActionForm>
      {link && !done && (
        <Link href={link.href(clientId)} className="text-xs font-semibold text-primary hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  )
}

function DoneBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-3 py-1.5 text-sm font-bold text-success">
      <Check className="h-4 w-4" aria-hidden="true" /> Done
    </span>
  )
}
