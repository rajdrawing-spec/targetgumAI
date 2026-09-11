import { SkeletonCard, SkeletonPageHeader, SkeletonTable } from '@/components/ui/skeleton'

/**
 * Default loading state for every /dashboard route without its own
 * `loading.tsx`. Next.js streams this instantly on navigation while the
 * page's server render is still running, so the sidebar stays interactive
 * and the content area shows an outline rather than the previous page.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <SkeletonPageHeader />
      <SkeletonTable rows={6} />
      <SkeletonCard lines={2} />
    </div>
  )
}
