/**
 * Gummy mascot asset registry (docs/DECISIONS.md 2026-09-24, "Gummy moods
 * + asset registry"; artwork added 2026-09-26).
 *
 * The art under `public/mascot/` is cut from the approved "Meet Gummy!"
 * brand sheet (the red bird in the black TargetGum hoodie) - transparent
 * WebP, trimmed to the character. Every `<GummyMascot>` on every surface
 * renders the image registered for its mood; the SVG drawing in
 * `src/components/growth/mascot.tsx` is only the fallback for a mood with
 * no artwork.
 *
 * `face` locates the eyes and the top of the head as percentages of the
 * image, so Growth Shop outfits (shades, party hat) sit on the character
 * no matter how large it's drawn.
 */
export type GummyMood =
  /** Waving hello - onboarding, landing, empty states. */
  | 'happy'
  /** Holding a checklist - questions, planning, AI suggestions. */
  | 'thinking'
  /** Both wings up - correct answers, lesson complete, achievements. */
  | 'celebrate'
  /** Wink + thumbs up - streaks, quests, "keep going". */
  | 'cheer'
  /** Wink + pointing - wrong answer / "look at this" (always encouraging copy). */
  | 'oops'
  /** The large brand-sheet pose - hero placements (landing, Growth Map start, level card). */
  | 'hero'
  /** At the laptop - AI Coach, working on a campaign. */
  | 'coach'
  /** Megaphone - launching a campaign, announcements. */
  | 'launch'

export interface MascotImage {
  src: string
  width: number
  height: number
  /** Eye-line centre (x, y) and eye span, in % of the image. */
  face: { x: number; y: number; span: number }
  /** Top-of-head centre, in % of the image (party hat anchor). */
  crown: { x: number; y: number }
}

export const MASCOT_IMAGES: Partial<Record<GummyMood, MascotImage>> = {
  hero: { src: '/mascot/gummy-hero.webp', width: 446, height: 570, face: { x: 46.3, y: 39.2, span: 30 }, crown: { x: 50, y: 4 } },
  happy: { src: '/mascot/gummy-happy.webp', width: 156, height: 201, face: { x: 58.2, y: 42, span: 32 }, crown: { x: 58, y: 5 } },
  thinking: { src: '/mascot/gummy-thinking.webp', width: 129, height: 176, face: { x: 46.5, y: 41, span: 34 }, crown: { x: 47, y: 5 } },
  celebrate: { src: '/mascot/gummy-celebrate.webp', width: 171, height: 199, face: { x: 50, y: 45, span: 28 }, crown: { x: 50, y: 8 } },
  cheer: { src: '/mascot/gummy-cheer.webp', width: 126, height: 169, face: { x: 47.5, y: 42.5, span: 30 }, crown: { x: 47, y: 5 } },
  oops: { src: '/mascot/gummy-oops.webp', width: 152, height: 199, face: { x: 49.5, y: 40.5, span: 29 }, crown: { x: 49, y: 5 } },
  launch: { src: '/mascot/gummy-launch.webp', width: 141, height: 171, face: { x: 45.4, y: 41.5, span: 29 }, crown: { x: 45, y: 5 } },
  coach: { src: '/mascot/gummy-coach.webp', width: 181, height: 195, face: { x: 55.3, y: 50, span: 24 }, crown: { x: 55, y: 12 } },
}
