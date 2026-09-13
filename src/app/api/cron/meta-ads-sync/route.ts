import { NextResponse } from 'next/server'
import { recordAuditEvent } from '@/lib/audit/record'
import { recordIntegrationFailure } from '@/lib/integrations/health'
import { findMetaAdsConnectionsDueForSync } from '@/lib/integrations/meta-ads/schedule'
import { syncMetaAdAccountTelemetry } from '@/lib/integrations/meta-ads/sync'
import { resolveAutomationActor } from '@/lib/queue/resolve-actor'

/**
 * Scheduled Meta Ads telemetry refresh - fixes the "Synced <date>"
 * timestamp on a client's Integrations tab never moving on its own. Before
 * this, `lastSuccessfulSyncAt` had exactly two writers: connecting the
 * account, and a human clicking "Sync Live Data" - see docs/DECISIONS.md,
 * 2026-09-13.
 *
 * Unlike the weekly AI-analysis cron (src/app/api/cron/weekly-intelligence/
 * route.ts), this does the actual sync work inline rather than enqueuing to
 * BullMQ: a handful of Graph API calls and DB upserts per connection is
 * fast and has no LLM cost, so it comfortably fits inside one serverless
 * invocation without needing the separate always-on worker process the
 * weekly job requires (that job calls Claude and can run long; this one
 * doesn't). `maxDuration` is raised for the (likely) case of syncing many
 * connections in one run - see docs/ARCHITECTURE.md's Scheduled Automation
 * section for the two-process topology this deliberately avoids needing.
 *
 * Meant to be called on a schedule by Vercel Cron (a `crons` entry in
 * vercel.json pointing at this path - see there for the configured
 * cadence). Vercel signs its own cron requests with this exact
 * `Authorization: Bearer <CRON_SECRET>` header automatically once
 * `CRON_SECRET` is set as an env var - without checking it, anyone who
 * finds this URL could trigger unbounded Meta Graph API calls using every
 * client's stored credentials (BRD Section 15/116).
 *
 * Runs as the same real, already-permissioned staff actor as every other
 * automated action in this codebase (`resolveAutomationActor` - never a
 * fabricated "system" identity, docs/SECURITY.md invariant 3). A
 * connection whose client has no eligible staff assigned is skipped and
 * audited as DENIED, same as the weekly intelligence job - not treated as
 * a sync failure.
 */
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const due = await findMetaAdsConnectionsDueForSync()
  let synced = 0
  let failed = 0
  let skipped = 0

  for (const { connectionId, clientId, organizationId } of due) {
    const ctx = await resolveAutomationActor(organizationId, clientId)
    if (!ctx) {
      skipped++
      await recordAuditEvent({
        organizationId,
        clientId,
        action: 'integrations.meta_ads.sync_skipped',
        result: 'DENIED',
        error: 'No active employee assigned to this client - nobody to run the automated sync as.',
      })
      continue
    }

    try {
      await syncMetaAdAccountTelemetry(ctx, clientId, undefined, undefined, connectionId)
      synced++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Meta Ads sync failed.'
      await recordIntegrationFailure(connectionId, message)
    }
  }

  return NextResponse.json({ due: due.length, synced, failed, skipped })
}
