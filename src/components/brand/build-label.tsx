/** Tiny, non-sensitive build identifier (next.config.mjs) - lets anyone confirm which deploy they're looking at. */
export function BuildLabel({ className }: { className?: string }) {
  return (
    <p className={className} aria-label="Build identifier">
      TargetGum build {process.env.NEXT_PUBLIC_TG_BUILD ?? 'unknown'}
    </p>
  )
}
