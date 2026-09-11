import { SkeletonCard, SkeletonPageHeader } from '@/components/ui/skeleton'

export default function PortalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <SkeletonPageHeader />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
  )
}
