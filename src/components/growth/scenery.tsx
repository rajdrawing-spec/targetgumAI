import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Decorative scenery pieces from the approved mockup - purely ornamental, `aria-hidden`. */

interface IconProps {
  className?: string
  style?: CSSProperties
}

export function TreeIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 40 56" className={cn('block', className)} style={style} aria-hidden="true">
      <rect x="16" y="34" width="8" height="20" rx="2" fill="#8B5A2B" />
      <circle cx="20" cy="24" r="15" fill="#5FA83D" />
      <circle cx="9" cy="30" r="10" fill="#6DBB47" />
      <circle cx="31" cy="30" r="10" fill="#6DBB47" />
    </svg>
  )
}

export function RockIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 32 22" className={cn('block', className)} style={style} aria-hidden="true">
      <path d="M2 20 Q0 10 8 8 Q10 2 18 4 Q26 2 30 10 Q32 18 26 20 Z" fill="#9C9C9C" />
    </svg>
  )
}

export function CloudIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 32" className={cn('block text-border', className)} style={style} aria-hidden="true">
      <ellipse cx="18" cy="20" rx="16" ry="11" fill="currentColor" />
      <ellipse cx="34" cy="13" rx="18" ry="13" fill="currentColor" />
      <ellipse cx="50" cy="20" rx="14" ry="10" fill="currentColor" />
    </svg>
  )
}

export function TrophyIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 60 68" className={cn('block', className)} style={style} aria-hidden="true">
      <rect x="20" y="48" width="20" height="8" rx="2" fill="#B9860F" />
      <rect x="14" y="56" width="32" height="8" rx="2" fill="#8A5A2C" />
      <path d="M20 6h20v20a10 10 0 0 1-20 0Z" fill="#F2C14E" />
      <path d="M20 10c-6 0-10 4-10 9s4 8 9 8" fill="none" stroke="#F2C14E" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 10c6 0 10 4 10 9s-4 8-9 8" fill="none" stroke="#F2C14E" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 44h16l-3 6H25Z" fill="#D4A017" />
      <path d="M27 4l3 5 3-5" fill="none" stroke="#FBE9CF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
