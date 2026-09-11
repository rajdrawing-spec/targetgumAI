import { Skeleton, SkeletonPageHeader, SkeletonTable } from '@/components/ui/skeleton'

export default function ClientsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SkeletonPageHeader />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <SkeletonTable rows={5} cols={6} />
    </div>
  )
}
