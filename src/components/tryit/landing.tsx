import Link from 'next/link'
import { ArrowRight, BarChart3, BookOpen, Check, Flame, Gem, Megaphone, Rocket, Target } from 'lucide-react'
import { BrandMark } from '@/components/brand/brand-mark'
import { GummyMascot } from '@/components/growth/mascot'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LOOP = [
  { icon: BookOpen, title: 'Learn', body: 'Bite-sized lessons on audiences, offers, creatives and budgets - in plain words.' },
  { icon: Target, title: 'Practise', body: 'Make real marketing decisions and get instant feedback from Gummy.' },
  { icon: Megaphone, title: 'Apply', body: 'Turn what you learned into a real campaign plan for your own business.' },
  { icon: BarChart3, title: 'Grow', body: 'Launch, measure and optimise with AI insights once you unlock TargetGum.' },
]

/**
 * The signed-out landing page (docs/DECISIONS.md 2026-09-24): the first
 * experience is "Let's start growing your business", not a login wall.
 * Static - no data, no auth context - and every CTA leads to the public
 * try-it (/start) or the existing invite sign-in.
 */
export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card/95">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <BrandMark />
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link href="/sign-in" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              Sign in
            </Link>
            <Link href="/start" className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}>
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Rocket className="h-3.5 w-3.5" aria-hidden="true" /> Your AI marketing coach
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Let&apos;s start growing <span className="text-primary">your business.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              TargetGum turns marketing into small, clear steps. Learn it, practise it, then launch real campaigns - with Gummy cheering you on.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/start" className={cn(buttonVariants({ size: 'lg' }), 'uppercase tracking-wide')}>
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/sign-in" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                I have an invite
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {['No account needed to start', 'Takes 5 minutes', 'Made for beginners and pros'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto flex w-full max-w-md items-center justify-center py-6" aria-hidden="true">
            <div className="absolute inset-6 rounded-full bg-primary-tint" />
            <GummyMascot mood="happy" animate className="relative h-72 w-60" />
            <div className="absolute right-0 top-4 rotate-3 rounded-2xl border-2 border-border bg-card px-4 py-2 font-display text-xl font-extrabold text-foreground shadow-card">
              Let&apos;s <span className="text-primary">grow!</span>
            </div>
            <div className="absolute bottom-10 left-0 flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-3 py-2 shadow-card">
              <Flame className="h-6 w-6 text-mustard" />
              <span className="text-sm font-bold text-foreground">7 day streak</span>
            </div>
            <div className="absolute bottom-2 right-4 flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-3 py-2 shadow-card">
              <Gem className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-primary">+50 XP</span>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card" aria-labelledby="loop-title">
          <div className="mx-auto w-full max-w-6xl px-4 py-14">
            <h2 id="loop-title" className="text-center font-display text-3xl font-extrabold text-foreground">
              Small steps. Big results.
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LOOP.map((step, i) => (
                <li key={step.title} className="rounded-3xl border-2 border-border bg-background p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-display text-lg font-bold text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center">
          <GummyMascot mood="cheer" className="h-28 w-24" />
          <h2 className="font-display text-3xl font-extrabold text-foreground">Ready for your first marketing mission?</h2>
          <p className="text-muted-foreground">Tell Gummy about your business and finish your first lesson in a few minutes.</p>
          <Link href="/start" className={cn(buttonVariants({ size: 'lg' }), 'uppercase tracking-wide')}>
            Start my growth journey <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>TargetGum · Precision Marketing. Real Results.</span>
          <span className="font-semibold uppercase tracking-widest">Learn · Plan · Create · Launch · Grow</span>
        </div>
      </footer>
    </div>
  )
}
