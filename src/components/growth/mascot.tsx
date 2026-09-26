'use client'

import type { ReactNode } from 'react'
import { MASCOT_IMAGES, type GummyMood, type MascotImage } from '@/lib/brand/mascot-assets'
import { cn } from '@/lib/utils'
import type { GummyOutfit } from '@/lib/growth/shop-catalog'
import { useGummyStyle } from './gummy-style'

export type { GummyMood } from '@/lib/brand/mascot-assets'

/**
 * "Gummy", TargetGum's mascot - the red bird in the black TargetGum hoodie
 * from the approved brand sheet. Renders the artwork registered for the
 * mood in `MASCOT_IMAGES` (src/lib/brand/mascot-assets.ts); the simple SVG
 * drawing below is only a fallback for a mood without artwork.
 *
 * Decorative by default (`aria-hidden`) - the speech text next to Gummy
 * carries the meaning, never the drawing itself.
 */
export function GummyMascot({
  className,
  animate = false,
  mood = 'happy',
  outfit,
}: {
  className?: string
  animate?: boolean
  mood?: GummyMood
  /** Growth Shop outfit; defaults to the one equipped for the current Client Workspace. */
  outfit?: GummyOutfit | null
}) {
  const styled = useGummyStyle()
  const wearing = outfit === undefined ? styled.outfit : outfit
  const motion = animate && (mood === 'celebrate' ? 'motion-safe:animate-hop' : 'motion-safe:animate-sway')
  const art = MASCOT_IMAGES[mood]
  if (art) {
    // The artwork lives in an SVG whose viewBox is the image's own pixel
    // space: callers size Gummy with the same h-/w- classes as before
    // (bottom-aligned, aspect kept), and outfits are drawn in image
    // coordinates so they land on the face at any size.
    return (
      <svg
        viewBox={`0 0 ${art.width} ${art.height}`}
        preserveAspectRatio="xMidYMax meet"
        overflow="visible"
        className={cn('block', motion, className)}
        aria-hidden="true"
      >
        <image href={art.src} width={art.width} height={art.height} />
        {wearing && <ArtOutfitLayer outfit={wearing} art={art} />}
      </svg>
    )
  }

  // Wing/eye/mouth geometry per mood; body, comb and hoodie are shared.
  const leftWing =
    mood === 'celebrate' ? { cx: 18, cy: 56, rot: 35 } : mood === 'oops' ? { cx: 24, cy: 84, rot: -8 } : { cx: 22, cy: 78, rot: -18 }
  const rightWing =
    mood === 'thinking' ? { cx: 74, cy: 58, rot: -30 } : mood === 'oops' ? { cx: 76, cy: 84, rot: 8 } : { cx: 82, cy: 62, rot: 35 }
  const leftHand = mood === 'celebrate' ? { cx: 10, cy: 44 } : mood === 'oops' ? { cx: 20, cy: 97 } : { cx: 14, cy: 90 }
  const rightHand = mood === 'thinking' ? { cx: 62, cy: 46 } : mood === 'oops' ? { cx: 80, cy: 97 } : { cx: 90, cy: 48 }

  return (
    <svg viewBox="0 0 100 122" overflow="visible" className={cn('block', motion, className)} aria-hidden="true">
      <ellipse cx="50" cy="82" rx="29" ry="33" fill="#171717" />
      <ellipse cx="50" cy="106" rx="24" ry="7" fill="#E5252A" />
      <ellipse cx={leftWing.cx} cy={leftWing.cy} rx="9" ry="16" fill="#171717" transform={`rotate(${leftWing.rot} ${leftWing.cx} ${leftWing.cy})`} />
      <ellipse cx={rightWing.cx} cy={rightWing.cy} rx="9" ry="17" fill="#171717" transform={`rotate(${rightWing.rot} ${rightWing.cx} ${rightWing.cy})`} />
      <circle cx={leftHand.cx} cy={leftHand.cy} r="5.5" fill="#F5A623" />
      <circle cx={rightHand.cx} cy={rightHand.cy} r="5.5" fill="#F5A623" />
      <ellipse cx="50" cy="85" rx="16" ry="22" fill="#FFFFFF" />
      <circle cx="50" cy="66" r="9.5" fill="#E5252A" />
      <circle cx="50" cy="66" r="5.8" fill="#FFFFFF" />
      <circle cx="50" cy="66" r="2.6" fill="#E5252A" />
      <circle cx="50" cy="34" r="24" fill="#FFFFFF" />
      <path d="M32 14 L38 1 L44 14 L50 -1 L56 14 L62 1 L68 14 Z" fill="#E5252A" />
      <ellipse cx="33" cy="40" rx="4.2" ry="2.6" fill="#FFC1C1" opacity=".75" />
      <ellipse cx="67" cy="40" rx="4.2" ry="2.6" fill="#FFC1C1" opacity=".75" />
      <GummyEyes mood={mood} />
      {mood === 'celebrate' || mood === 'cheer' ? (
        <path d="M44 41 L56 41 Q50 52 44 41 Z" fill="#F5A623" />
      ) : (
        <path d="M45 40 L55 40 L50 48 Z" fill="#F5A623" />
      )}
      <ellipse cx="38" cy="119" rx="7.5" ry="4" fill="#F5A623" />
      <ellipse cx="62" cy="119" rx="7.5" ry="4" fill="#F5A623" />
      {wearing && <GummyOutfitLayer outfit={wearing} />}
    </svg>
  )
}

/** Growth Shop outfits over the artwork, positioned from the image's face/crown anchors. */
function ArtOutfitLayer({ outfit, art }: { outfit: GummyOutfit; art: MascotImage }) {
  const s = (art.face.span / 100) * art.width // distance between the eyes, px
  if (outfit === 'shades') {
    const fx = (art.face.x / 100) * art.width
    const fy = (art.face.y / 100) * art.height
    const lw = s * 0.78
    const lh = s * 0.52
    return (
      <g>
        <rect x={fx - s / 2 - lw / 2} y={fy - lh / 2} width={lw} height={lh} rx={lh * 0.38} fill="#111" />
        <rect x={fx + s / 2 - lw / 2} y={fy - lh / 2} width={lw} height={lh} rx={lh * 0.38} fill="#111" />
        <path d={`M${fx - s / 2 + lw / 2} ${fy - lh * 0.15} L${fx + s / 2 - lw / 2} ${fy - lh * 0.15}`} stroke="#111" strokeWidth={lh * 0.18} />
        <path d={`M${fx - s / 2 - lw * 0.25} ${fy - lh * 0.2} L${fx - s / 2 + lw * 0.05} ${fy - lh * 0.2}`} stroke="#fff" strokeWidth={lh * 0.1} strokeLinecap="round" opacity=".6" />
        <path d={`M${fx + s / 2 - lw * 0.25} ${fy - lh * 0.2} L${fx + s / 2 + lw * 0.05} ${fy - lh * 0.2}`} stroke="#fff" strokeWidth={lh * 0.1} strokeLinecap="round" opacity=".6" />
      </g>
    )
  }
  const cx = (art.crown.x / 100) * art.width
  const cy = (art.crown.y / 100) * art.height
  const base = s * 1.05
  const tall = s * 1.3
  return (
    <g transform={`rotate(12 ${cx} ${cy})`}>
      <path d={`M${cx - base / 2} ${cy + base * 0.1} L${cx + base / 2} ${cy + base * 0.1} L${cx} ${cy - tall} Z`} fill="#3B82F6" />
      <path
        d={`M${cx - base * 0.34} ${cy - tall * 0.2} L${cx + base * 0.34} ${cy - tall * 0.2} M${cx - base * 0.2} ${cy - tall * 0.52} L${cx + base * 0.2} ${cy - tall * 0.52}`}
        stroke="#FFC107"
        strokeWidth={base * 0.1}
      />
      <circle cx={cx} cy={cy - tall} r={base * 0.14} fill="#FFC107" />
    </g>
  )
}

/** Growth Shop outfits, drawn over the fallback SVG (docs/DECISIONS.md 2026-09-24). */
function GummyOutfitLayer({ outfit }: { outfit: GummyOutfit }) {
  if (outfit === 'shades') {
    return (
      <g>
        <rect x="33" y="26" width="15" height="10" rx="4" fill="#111" />
        <rect x="52" y="26" width="15" height="10" rx="4" fill="#111" />
        <path d="M48 30 L52 30" stroke="#111" strokeWidth="2" />
        <path d="M36 28.5 L41 28.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
        <path d="M55 28.5 L60 28.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      </g>
    )
  }
  return (
    <g transform="rotate(12 50 8)">
      <path d="M38 14 L62 14 L50 -14 Z" fill="#3B82F6" />
      <path d="M41 7 L59 7 M44 0 L56 0" stroke="#FFC107" strokeWidth="3" />
      <circle cx="50" cy="-15" r="4" fill="#FFC107" />
    </g>
  )
}

function GummyEyes({ mood }: { mood: GummyMood }) {
  if (mood === 'celebrate') {
    // Happy closed eyes (upward arcs).
    return (
      <g fill="none" stroke="#171717" strokeWidth="2.4" strokeLinecap="round">
        <path d="M37 33 Q41 28 45 33" />
        <path d="M55 33 Q59 28 63 33" />
      </g>
    )
  }
  if (mood === 'cheer') {
    return (
      <g>
        <circle cx="41" cy="32" r="3.4" fill="#171717" />
        <circle cx="42.4" cy="30.6" r="1.1" fill="#fff" />
        <path d="M55 32 Q59 29 63 32" fill="none" stroke="#171717" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <circle cx="41" cy="32" r="3.4" fill="#171717" />
      <circle cx="59" cy="32" r="3.4" fill="#171717" />
      <circle cx="42.4" cy="30.6" r="1.1" fill="#fff" />
      <circle cx="60.4" cy="30.6" r="1.1" fill="#fff" />
      {mood === 'thinking' && <path d="M54 25 L64 23" stroke="#171717" strokeWidth="1.8" strokeLinecap="round" />}
      {mood === 'oops' && (
        <g stroke="#171717" strokeWidth="1.8" strokeLinecap="round">
          <path d="M36 25 L45 27" />
          <path d="M64 25 L55 27" />
        </g>
      )}
    </g>
  )
}

/**
 * Gummy + a speech bubble - the one way Gummy "talks" anywhere in the app,
 * so tone and layout stay consistent. `children` is the line Gummy says;
 * it's real text, announced politely when it changes (`live`).
 */
export function GummyCoach({
  mood = 'happy',
  children,
  className,
  mascotClassName,
  animate = false,
  live = false,
  tone = 'neutral',
}: {
  mood?: GummyMood
  children: ReactNode
  className?: string
  mascotClassName?: string
  animate?: boolean
  live?: boolean
  tone?: 'neutral' | 'tint'
}) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <GummyMascot mood={mood} animate={animate} className={cn('h-16 w-14 shrink-0', mascotClassName)} />
      <div
        className={cn(
          'relative mb-3 rounded-2xl border-2 px-4 py-2.5 text-sm font-medium leading-snug text-foreground',
          tone === 'tint' ? 'border-primary/20 bg-primary-tint' : 'border-border bg-card',
        )}
        aria-live={live ? 'polite' : undefined}
      >
        {children}
      </div>
    </div>
  )
}
