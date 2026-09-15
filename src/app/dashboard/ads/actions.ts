'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { runAction, actionOk } from '@/lib/actions/result'
import type { ActionResult } from '@/lib/actions/result'
import { toggleCampaignStatus, purgeAllDummyData, listCampaigns } from '@/lib/ads/service'
import { analyzeAdImpressionsAndPerformance, createAndShareClientReport } from '@/lib/ads/analyzer'

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new Error('You must be signed in.')
  return ctx
}

// Campaign creation lives at src/app/dashboard/ads/new/actions.ts (the
// guided wizard) - the old createCampaignAction here wrote a fake,
// fabricated providerCampaignId straight to the database and never called
// a real ad platform; removed rather than kept alongside a real path, see
// docs/DECISIONS.md.

export async function toggleCampaignStatusAction(campaignId: string, currentStatus: string): Promise<ActionResult> {
  return runAction('toggle-campaign-status', async () => {
    const ctx = await requireCtx()
    const updated = await toggleCampaignStatus(ctx, campaignId, currentStatus)
    revalidatePath('/dashboard/ads')
    return actionOk(`Campaign set to ${updated.status}.`)
  })
}

export async function purgeDummyDataAction(): Promise<ActionResult> {
  return runAction('purge-dummy-data', async () => {
    const ctx = await requireCtx()
    const result = await purgeAllDummyData(ctx)
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard/ads/analytics')
    revalidatePath('/dashboard/clients')
    revalidatePath('/dashboard')
    return actionOk(`Purged dummy data successfully. Removed ${result.purgedClients} demo clients and sample campaigns.`)
  })
}

export async function syncMetaAdsAction(clientId?: string): Promise<ActionResult> {
  return runAction('sync-meta-ads', async () => {
    const ctx = await requireCtx()
    const { syncMetaAdAccountTelemetry } = await import('@/lib/integrations/meta-ads/sync')
    const { listAccessibleClients } = await import('@/lib/clients/list')
    const { db } = await import('@/lib/db/client')

    let targetClientIds: string[] = []
    if (clientId) {
      targetClientIds = [clientId]
    } else {
      const clients = await listAccessibleClients(ctx)
      targetClientIds = clients.map((c) => c.id)
    }

    // A client can have several Meta Ads connections (multiple ad
    // accounts) - sync every one of them, not just "the client's first
    // Meta Ads connection" (that used to silently leave the rest stale
    // forever - see docs/DECISIONS.md, 2026-09-13).
    const connections = await db.integrationConnection.findMany({
      where: {
        clientId: { in: targetClientIds },
        integrationAccount: { integration: { provider: 'META_ADS' } },
      },
      select: { id: true, clientId: true },
    })

    let totalCampaigns = 0
    let totalMetrics = 0

    for (const conn of connections) {
      try {
        const result = await syncMetaAdAccountTelemetry(ctx, conn.clientId, undefined, undefined, conn.id)
        totalCampaigns += result.syncedCampaigns
        totalMetrics += result.syncedMetrics
        revalidatePath(`/dashboard/clients/${conn.clientId}`)
      } catch (err) {
        if (clientId) {
          throw err
        }
      }
    }

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard/ads/analytics')
    revalidatePath('/dashboard')
    return actionOk(`Synced ${totalCampaigns} campaigns and ${totalMetrics} telemetry metrics from Meta Graph API!`)
  })
}

export async function generateClientReportAction(clientId: string): Promise<ActionResult> {
  return runAction('generate-client-report', async () => {
    const ctx = await requireCtx()
    const campaigns = await listCampaigns(ctx, clientId)
    const analysis = analyzeAdImpressionsAndPerformance(campaigns)
    const report = await createAndShareClientReport(ctx, clientId, analysis)

    revalidatePath('/dashboard/reports')
    revalidatePath(`/dashboard/clients/${clientId}`)
    revalidatePath(`/portal/clients/${clientId}`)
    revalidatePath('/portal')
    return actionOk(`AI Performance Report generated and shared with client! (Report: ${report.title})`)
  })
}
