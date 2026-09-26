import Link from 'next/link'
import { ArrowRight, Check, Lock, Target } from 'lucide-react'
import type { GrowthStageDef } from '@/lib/growth/stage-defs'
import { cn } from '@/lib/utils'
import { GummyMascot } from './mascot'
import { CloudIcon, RockIcon, TreeIcon, TrophyIcon } from './scenery'

export type MapStage = GrowthStageDef & { status: 'done' | 'current' | 'locked' }

/**
 * The Marketing Growth Map, laid out like the approved reference
 * (docs/DECISIONS.md 2026-09-26): a start island with Gummy, ten 3D stage
 * nodes zig-zagging down a dashed trail on grass islands, each with its
 * number/title/description beside it, and the Growth Master trophy at the
 * end.
 *
 * Every node is real navigation: done and current stages open their
 * lesson (the lesson page itself re-checks the stage state and
 * permissions), locked stages are plain text - never a link that goes
 * nowhere. Server-rendered, no client JS: positions are fixed per row,
 * and only the x column differs between phone and desktop, so the trail
 * is drawn twice (one SVG per breakpoint).
 */

const TOP = 350 // title + start island
const ROW = 112 // vertical distance between stages
const BOTTOM = 270 // trophy
// Node x-centre (% of width) for the two zig-zag columns.
const X = { mobile: [24, 76], desktop: [40, 60] } as const

function trailPath(xs: readonly number[], rows: number): string {
  const pts = [{ x: 45, y: TOP - 70 }, ...Array.from({ length: rows }, (_, i) => ({ x: xs[i % 2]!, y: TOP + i * ROW }))]
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const my = (a.y + b.y) / 2
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`
  }
  return d
}

function Trail({ xs, rows, doneThrough, className }: { xs: readonly number[]; rows: number; doneThrough: number; className: string }) {
  const height = TOP + (rows - 1) * ROW + BOTTOM
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden="true">
      <path d={trailPath(xs, rows)} fill="none" stroke="hsl(var(--border))" strokeWidth="5" strokeDasharray="10 12" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {doneThrough > 0 && (
        <path d={trailPath(xs, doneThrough + 1)} fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeDasharray="10 12" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=".75" />
      )}
    </svg>
  )
}

function Island({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        'absolute -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_25%,#8FD35A,#5DAA35_70%)] shadow-[0_7px_0_#8B6A3E,0_14px_18px_-6px_rgb(0_0_0/0.25)]',
        className,
      )}
    />
  )
}

function StageNode({ stage, href }: { stage: MapStage; href: string | null }) {
  const Icon = stage.status === 'done' ? Check : stage.status === 'current' ? Target : Lock
  const face = (
    <span
      className={cn(
        'relative flex items-center justify-center rounded-full border-[5px] transition-transform duration-200',
        stage.status === 'current' ? 'h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]' : 'h-[64px] w-[64px] sm:h-[76px] sm:w-[76px]',
        stage.status === 'locked'
          ? 'border-white bg-gradient-to-b from-[#E4E6EA] to-[#B9BEC6] text-[#5E6470] shadow-[0_6px_0_#9AA0A9]'
          : 'border-white bg-gradient-to-b from-[#F4555A] to-[#D0151B] text-white shadow-[0_6px_0_#9A0F14]',
        stage.status === 'current' && 'motion-safe:animate-glow-pulse',
        href && 'group-hover:scale-105 group-active:translate-y-[3px] group-active:shadow-none',
      )}
    >
      <Icon className={cn(stage.status === 'locked' ? 'h-7 w-7' : 'h-9 w-9')} strokeWidth={stage.status === 'done' ? 4 : 2.6} aria-hidden="true" />
    </span>
  )
  return href ? (
    <Link href={href} className="group block rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring" aria-label={`${stage.order}. ${stage.title} - ${stage.status === 'done' ? 'completed, review lesson' : 'start lesson'}`}>
      {face}
    </Link>
  ) : (
    <span aria-label={`${stage.order}. ${stage.title} - locked`} role="img">
      {face}
    </span>
  )
}

export function GrowthMap({ stages, clientId, canWrite, themeClass }: { stages: MapStage[]; clientId: string; canWrite: boolean; themeClass?: string }) {
  const rows = stages.length
  const height = TOP + (rows - 1) * ROW + BOTTOM
  const currentIndex = stages.findIndex((s) => s.status === 'current')
  const doneThrough = currentIndex === -1 ? rows - 1 : currentIndex
  const allDone = stages.every((s) => s.status === 'done')
  const lessonHref = (s: MapStage) => `/dashboard/clients/${clientId}/growth/lesson/${s.key}`

  return (
    <div className={cn('relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#F5FAFF] via-card to-[#F6FBF1]', themeClass)} style={{ height }}>
      <Trail xs={X.mobile} rows={rows} doneThrough={doneThrough} className="sm:hidden" />
      <Trail xs={X.desktop} rows={rows} doneThrough={doneThrough} className="hidden sm:block" />

      {/* Title + speech bubble */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
        <div>
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">Marketing Growth Map</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-lg">Complete missions. Earn XP. Grow your business.</p>
        </div>
        <div className="relative hidden shrink-0 -rotate-6 rounded-[2rem] border-2 border-border bg-card px-5 py-3 text-center shadow-subtle md:block">
          <p className="font-display text-lg font-extrabold leading-tight text-foreground">Let&apos;s</p>
          <p className="font-display text-xl font-extrabold leading-tight text-primary">grow together!</p>
          <span className="absolute -bottom-2 left-6 h-4 w-4 rotate-45 border-b-2 border-r-2 border-border bg-card" />
        </div>
      </div>

      {/* Start island */}
      <div className="absolute left-[45%] -translate-x-1/2" style={{ top: TOP - 225 }} aria-hidden="true">
        <div className="relative h-[190px] w-[280px]">
          <Island className="bottom-0 left-1/2 h-14 w-[240px]" />
          <span className="absolute bottom-5 left-[58%] h-10 w-28 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle,#fff_18%,#E1252B_19%,#E1252B_42%,#fff_43%,#fff_58%,#E1252B_59%)] shadow-[0_5px_0_#9A0F14]" />
          <GummyMascot mood="hero" animate className="absolute bottom-9 left-[58%] h-[168px] w-[132px] -translate-x-1/2" />
          <div className="absolute bottom-7 left-0 -rotate-6">
            <div className="relative rounded-md bg-gradient-to-b from-[#C98E50] to-[#A8713A] px-3 py-1.5 text-center shadow-[0_3px_0_#7A4E22]">
              <p className="font-display text-sm font-extrabold tracking-wide text-[#5A3413]">START</p>
              <p className="font-display text-[11px] font-bold leading-tight text-[#5A3413]">Your Growth Journey</p>
            </div>
            <span className="mx-auto block h-5 w-2 rounded-b bg-[#7A4E22]" />
          </div>
          <TreeIcon className="absolute bottom-6 right-0 w-7" />
        </div>
      </div>

      <ol aria-label="Growth Map stages">
        {stages.map((stage, i) => {
          const side = i % 2 // 0 = left column, 1 = right column
          const top = TOP + i * ROW
          const href = stage.status === 'locked' ? null : stage.status === 'current' && !canWrite ? null : lessonHref(stage)
          const muted = stage.status === 'locked'
          return (
            <li key={stage.key} className="contents">
              {/* island + node */}
              <Island
                className={cn('h-7 w-24 sm:w-28', side === 0 ? 'left-[24%] sm:left-[40%]' : 'left-[76%] sm:left-[60%]')}
                style={{ top: top + 22 }} // under the node's bottom edge
              />
              <div className={cn('absolute -translate-x-1/2 -translate-y-1/2', side === 0 ? 'left-[24%] sm:left-[40%]' : 'left-[76%] sm:left-[60%]')} style={{ top }}>
                <StageNode stage={stage} href={href} />
              </div>

              {/* label: mobile - toward the centre; desktop - outside the trail */}
              <div
                className={cn(
                  'absolute -translate-y-1/2',
                  side === 0
                    ? 'left-[calc(24%+48px)] right-3 text-left sm:left-auto sm:right-[calc(60%+56px)] sm:w-[34%] sm:text-right'
                    : 'left-3 right-[calc(24%+48px)] text-right sm:left-[calc(60%+56px)] sm:right-auto sm:w-[34%] sm:text-left',
                )}
                style={{ top }}
              >
                <p className={cn('font-display text-sm font-bold leading-tight sm:text-base', muted ? 'text-muted-foreground' : 'text-foreground')}>
                  {href ? (
                    <Link href={href} className="hover:text-primary">
                      {stage.order}. {stage.title}
                    </Link>
                  ) : (
                    <>
                      {stage.order}. {stage.title}
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-[13px]">{stage.description}</p>
                {stage.status === 'current' && href && (
                  <Link
                    href={href}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-[0_4px_0_#9A0F14] transition-transform active:translate-y-[2px] active:shadow-none sm:text-sm"
                  >
                    Start Mission <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
                {stage.status === 'current' && !canWrite && <p className="mt-1 text-xs font-semibold text-primary">Up next</p>}
              </div>

              {/* scenery on the empty side, every other row */}
              {i % 3 === 1 && <TreeIcon className={cn('absolute hidden w-8 sm:block', side === 0 ? 'left-[72%]' : 'left-[24%]')} style={{ top: top - 30 }} />}
              {i % 3 === 2 && <RockIcon className={cn('absolute hidden w-8 opacity-80 sm:block', side === 0 ? 'left-[70%]' : 'left-[26%]')} style={{ top: top + 10 }} />}
              {i % 4 === 3 && <CloudIcon className={cn('absolute w-16 opacity-70', side === 0 ? 'left-[84%]' : 'left-[3%]')} style={{ top: top - 44 }} />}
            </li>
          )
        })}
      </ol>

      {/* Growth Master finish */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: TOP + (rows - 1) * ROW + 70 }}>
        <div className="relative">
          <Island className="-bottom-3 left-1/2 h-8 w-40" />
          <TrophyIcon className="relative h-24 w-24 drop-shadow" />
        </div>
        <div className="mt-4 -rotate-3 rounded-md bg-gradient-to-b from-[#C98E50] to-[#A8713A] px-4 py-1.5 shadow-[0_3px_0_#7A4E22]">
          <p className="font-display text-base font-extrabold tracking-wide text-[#5A3413]">GROWTH MASTER</p>
        </div>
        {allDone && <p className="mt-2 text-sm font-semibold text-warning">Every stage complete!</p>}
      </div>
    </div>
  )
}
