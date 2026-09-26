import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark } from '@/components/brand/brand-mark'
import { TryItStats } from '@/components/tryit/try-it-stats'
import { ThemeToggle } from '@/components/theme-toggle'
import { BuildLabel } from '@/components/brand/build-label'

export const metadata: Metadata = {
  title: 'Start growing - TargetGum',
  description: 'Learn marketing, practise real decisions and plan your first campaign with Gummy, your AI marketing coach.',
}

/**
 * The public try-it shell (docs/DECISIONS.md 2026-09-24). Deliberately
 * outside /dashboard: no auth context is read here or in any page below,
 * no server action is exposed, and progress lives in the visitor's own
 * browser. Signed-in product surfaces stay behind the existing
 * page-level auth guards, unchanged.
 */
export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-3">
            <TryItStats />
            <ThemeToggle className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:flex" />
            <Link href="/sign-in" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <BuildLabel className="px-4 py-2 text-center text-[10px] text-caption" />
    </div>
  )
}
