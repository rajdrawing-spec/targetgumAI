import { db } from '@/lib/db/client'

// Matches the actual cron cadence in vercel.json (once daily - Vercel Cron
// on the Hobby plan rejects anything more frequent at deploy time, see
// docs/DECISIONS.md, 2026-09-13). Kept comfortably under 24h so a connection
// is always "due" by the next scheduled run even if that run lands a bit
// early/late, without also treating every connection as due immediately
// after a manual re-trigger on the same day.
const DEFAULT_SYNC_INTERVAL_MINUTES = 20 * 60

export interface DueMetaAdsConnection {
  connectionId: string
  clientId: string
  organizationId: string
}

/**
 * Finds every Meta Ads connection due for an automated telemetry refresh:
 * `CONNECTED` or `DEGRADED` (a connection stuck `AUTH_REQUIRED` needs a
 * human to re-supply a token - never silently retried, BRD Section 56 -
 * never fabricate/assume past a real auth failure) and either never synced
 * or last synced more than `intervalMinutes` ago.
 *
 * Unlike `findClientsDueForWeeklyIntelligence` (weekly AI analysis, which
 * spends LLM budget and BRD Section 65 requires explicit per-client
 * opt-in for), this needs no `ClientPolicy` opt-in flag: refreshing
 * read-only ad-platform telemetry has no spend and takes no action on the
 * client's behalf, so it's LOW risk per BRD Section 21 and safe to run for
 * every connected account by default. See docs/DECISIONS.md, 2026-09-13.
 *
 * Called by the cron route (src/app/api/cron/meta-ads-sync/route.ts), kept
 * here so it's testable without an HTTP layer - same shape as
 * `findClientsDueForWeeklyIntelligence`.
 */
export async function findMetaAdsConnectionsDueForSync(
  intervalMinutes: number = DEFAULT_SYNC_INTERVAL_MINUTES,
): Promise<DueMetaAdsConnection[]> {
  const cutoff = new Date(Date.now() - intervalMinutes * 60 * 1000)

  const connections = await db.integrationConnection.findMany({
    where: {
      integrationAccount: { integration: { provider: 'META_ADS' } },
      status: { in: ['CONNECTED', 'DEGRADED'] },
      OR: [{ lastSuccessfulSyncAt: null }, { lastSuccessfulSyncAt: { lt: cutoff } }],
    },
    select: { id: true, clientId: true, organizationId: true },
    orderBy: { lastSuccessfulSyncAt: 'asc' }, // stalest first, in case a run is cut short
  })

  return connections.map((c) => ({
    connectionId: c.id,
    clientId: c.clientId,
    organizationId: c.organizationId,
  }))
}
