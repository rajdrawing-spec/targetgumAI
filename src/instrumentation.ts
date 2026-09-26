/**
 * Runs once when the Next.js server starts. Logs the build identifier
 * (next.config.mjs) so the host's runtime log shows exactly which build is
 * serving traffic - the deploy-verification trail in docs/DECISIONS.md
 * 2026-09-26. Nothing secret is logged.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // eslint-disable-next-line no-console -- the one deliberate startup line (deploy verification)
    console.info(`[targetgum] serving build ${process.env.NEXT_PUBLIC_TG_BUILD ?? 'unknown'}`)
  }
}
