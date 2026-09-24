import Image from 'next/image'
import Link from 'next/link'

/** TargetGum logo + wordmark + tagline, for the public (signed-out) surfaces. */
export function BrandMark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-background transition-colors group-hover:border-primary">
        <Image src="/logo.jpg" alt="" width={36} height={36} className="object-contain" priority />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-extrabold leading-tight tracking-tight text-foreground">
          Target<span className="text-primary">Gum</span>
        </span>
        <span className="hidden text-[9px] font-semibold uppercase leading-tight tracking-widest text-muted-foreground sm:block">
          Precision Marketing. Real Results.
        </span>
      </span>
    </Link>
  )
}
