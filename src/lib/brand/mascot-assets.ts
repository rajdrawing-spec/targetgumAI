/**
 * Gummy mascot asset registry (docs/DECISIONS.md 2026-09-24, "Gummy moods
 * + asset registry").
 *
 * As of this entry the repository - and the Hostinger document root for
 * targetgum.com - contain NO raster mascot art: `public/` holds only
 * `logo.jpg`. Gummy is therefore drawn by the SVG in
 * `src/components/growth/mascot.tsx`, which is a documented placeholder
 * for the approved 3D renders shown in the brand sheet.
 *
 * To switch a mood to the real artwork: add a transparent PNG/WebP under
 * `public/mascot/` (e.g. `public/mascot/gummy-celebrate.png`) and map it
 * here. Every `<Gummy>` on every surface picks it up - no other code
 * change needed. Keep the source aspect ratio close to 100:122 (the SVG's
 * viewBox) so layouts don't shift when an image replaces the drawing.
 */
export type GummyMood =
  /** Default / waving - onboarding, landing, empty states. */
  | 'happy'
  /** Head tilt + raised wing - questions, AI suggestions. */
  | 'thinking'
  /** Both wings up - correct answers, lesson complete, achievements. */
  | 'celebrate'
  /** Thumbs-up wing + wink - streaks, quests, "keep going". */
  | 'cheer'
  /** Worried brow - wrong answer, out of hearts (always encouraging copy). */
  | 'oops'

export const MASCOT_IMAGES: Partial<Record<GummyMood, string>> = {}
