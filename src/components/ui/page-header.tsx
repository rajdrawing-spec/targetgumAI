import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-[#A1A1AA] leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  )
}
