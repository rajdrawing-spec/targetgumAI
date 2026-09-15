import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertClientAccess } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import {
  getProviderConnection,
  loadProviderCredentials,
  recordIntegrationFailure,
  recordIntegrationSuccess,
  saveProviderCredentials,
} from '@/lib/integrations/health'
import {
  fetchCampaignInsights,
  fetchMetaCampaigns,
  fetchMetaDailyInsights,
  verifyMetaCredentials,
} from './meta-client'

export interface MetaCredentialsPayload {
  accessToken: string
  adAccountId: string
  appId?: string
  appSecret?: string
}

/**
 * Resolves active Meta credentials for a given client:
 * 1. Checks per-client encrypted credentials in database
 * 2. Falls back to environment variables (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID)
 *
 * NOTE: a client can have more than one Meta Ads connection (multiple ad
 * accounts), and `getProviderConnection` resolves the *first* one found -
 * this is only correct when the client has exactly one. Callers that need
 * to target a specific ad account (a specific connection row) must use
 * `resolveMetaCredentialsForConnection` instead - see
 * `syncMetaAdAccountTelemetry`'s `connectionId` parameter.
 */
export async function resolveMetaCredentials(
  clientId: string,
): Promise<MetaCredentialsPayload | null> {
  const connection = await getProviderConnection(clientId, 'META_ADS')
  if (!connection) return null
  return resolveMetaCredentialsForConnection(connection)
}

/**
 * Same resolution as `resolveMetaCredentials`, but scoped to one specific
 * connection row rather than "whichever connection this client's first
 * Meta Ads account happens to be" - required once a client has more than
 * one Meta Ads connection (docs/DECISIONS.md, 2026-09-13 - "sync a specific
 * ad account, not just the client's first one").
 */
export async function resolveMetaCredentialsForConnection(connection: {
  encryptedCredentials: string | null
  integrationAccount: { externalAccountId: string }
}): Promise<MetaCredentialsPayload | null> {
  if (connection.encryptedCredentials) {
    try {
      const creds = loadProviderCredentials<MetaCredentialsPayload>(connection)
      if (creds?.accessToken && creds?.adAccountId) {
        return creds
      }
    } catch (err) {
      console.warn(
        `[Meta Ads] Stored credentials for connection could not be decrypted (encryption key changed):`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  // Fallback to environment variables
  const envToken = process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_ACCESS_TOKEN
  const envAdAccount = process.env.META_AD_ACCOUNT_ID
  if (envToken && (envAdAccount || connection.integrationAccount.externalAccountId)) {
    return {
      accessToken: envToken,
      adAccountId: (envAdAccount || connection.integrationAccount.externalAccountId)!,
      appId: process.env.META_APP_ID,
      appSecret: process.env.META_APP_SECRET,
    }
  }

  return null
}

/**
 * Syncs real campaigns and live telemetry insights from Meta Graph API
 * into TargetGum's database.
 *
 * `connectionId`, when given, targets one specific Meta Ads connection -
 * required as soon as a client has more than one connected ad account
 * (each "Sync Live Data" click, and each automated sync tick, must refresh
 * *that* account, not always whichever one `getProviderConnection` finds
 * first). Omit it only for the connect-time call (`connect.ts`), which
 * already has an explicit account id + token and doesn't need a lookup.
 */
export async function syncMetaAdAccountTelemetry(
  ctx: AuthContext,
  clientId: string,
  explicitAdAccountId?: string,
  explicitAccessToken?: string,
  connectionId?: string,
) {
  assertClientAccess(ctx, { id: clientId, organizationId: ctx.organizationId })
  const client = await getAuthorizedClient(ctx, clientId)

  let accessToken = explicitAccessToken
  let adAccountId = explicitAdAccountId
  let resolvedConnectionId = connectionId

  if (!accessToken || !adAccountId) {
    const connection = connectionId
      ? await db.integrationConnection.findFirst({
          where: { id: connectionId, clientId: client.id },
          include: { integrationAccount: true },
        })
      : await getProviderConnection(clientId, 'META_ADS')
    if (!connection) {
      throw new Error('No Meta Ads connection found for this client.')
    }

    const resolved = await resolveMetaCredentialsForConnection(connection)
    if (!resolved) {
      throw new Error(
        'No Meta Ads credentials found. Please provide an Access Token and Ad Account ID.',
      )
    }
    accessToken = accessToken || resolved.accessToken
    adAccountId = adAccountId || resolved.adAccountId
    resolvedConnectionId = resolvedConnectionId || connection.id
  }

  // 1. Verify token
  await verifyMetaCredentials(accessToken)

  // 2. Fetch live campaigns from Meta Graph API
  const metaCampaigns = await fetchMetaCampaigns(adAccountId, accessToken)

  // 3. Upsert real campaigns into the database
  let syncedCampaigns = 0
  const campaignMap = new Map<string, string>() // metaCampaignId -> local db id

  for (const c of metaCampaigns) {
    const existing = await db.campaign.findFirst({
      where: {
        organizationId: ctx.organizationId,
        clientId: client.id,
        provider: 'META_ADS',
        providerCampaignId: c.id,
      },
    })

    let localId: string
    if (existing) {
      const updated = await db.campaign.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          status: c.status,
          budget: c.dailyBudget ?? c.lifetimeBudget ?? existing.budget,
        },
      })
      localId = updated.id
    } else {
      const created = await db.campaign.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: client.id,
          provider: 'META_ADS',
          providerCampaignId: c.id,
          name: c.name,
          channel: 'Meta Ads - Facebook & Instagram',
          status: c.status,
          budget: c.dailyBudget ?? c.lifetimeBudget ?? 0,
          startDate: c.startTime ? new Date(c.startTime) : new Date(),
        },
      })
      localId = created.id
    }

    campaignMap.set(c.id, localId)
    syncedCampaigns++
  }

  // 4. Fetch performance insights from Meta Graph API. Meta rejects a
  // day-by-day breakdown (time_increment=1, which fetchMetaDailyInsights
  // always sets) spanning more than 90 days - "date_preset=maximum" (up to
  // 37 months) combined with that always fails once an account has any real
  // history, which used to mean this made a guaranteed-to-fail call on
  // *every single sync* (and every new connection, via connect.ts) before
  // ever trying a valid window. That inflated Meta's own measured error
  // rate for this app - see docs/DECISIONS.md. Request the valid window
  // directly instead.
  let metaInsights: any[] = []
  try {
    metaInsights = await fetchMetaDailyInsights(adAccountId, accessToken, {
      datePreset: 'last_90d',
    })
  } catch (err) {
    console.warn(`[Meta Ads] fetchMetaDailyInsights last_90d failed:`, err)
  }

  let syncedMetrics = 0
  const campaignsWithMetrics = new Set<string>()

  for (const insight of metaInsights) {
    const localCampaignId = campaignMap.get(insight.campaignId)
    if (!localCampaignId) continue

    const insightDate = new Date(insight.date)
    const existingMetric = await db.campaignMetric.findFirst({
      where: {
        organizationId: ctx.organizationId,
        clientId: client.id,
        campaignId: localCampaignId,
        date: insightDate,
      },
    })

    if (existingMetric) {
      await db.campaignMetric.update({
        where: { id: existingMetric.id },
        data: {
          impressions: insight.impressions,
          clicks: insight.clicks,
          spend: insight.spend,
          ctr: insight.ctr,
          cpc: insight.cpc,
          conversions: insight.conversions,
          revenue: insight.revenue,
          roas: insight.roas,
          retrievedAt: new Date(),
          raw: insight.raw as any,
        },
      })
    } else {
      await db.campaignMetric.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: client.id,
          campaignId: localCampaignId,
          date: insightDate,
          source: 'META_ADS',
          retrievedAt: new Date(),
          period: 'daily',
          impressions: insight.impressions,
          clicks: insight.clicks,
          spend: insight.spend,
          ctr: insight.ctr,
          cpc: insight.cpc,
          conversions: insight.conversions,
          revenue: insight.revenue,
          roas: insight.roas,
          raw: insight.raw as any,
        },
      })
    }
    campaignsWithMetrics.add(localCampaignId)
    syncedMetrics++
  }

  // 4b. Direct campaign fallback: for any campaign that got 0 daily metrics,
  // fetch direct campaign insights - skipping ARCHIVED/DELETED campaigns,
  // which will never have fresh insights and are a real source of wasted
  // (and sometimes erroring) Ads API calls for no benefit.
  for (const c of metaCampaigns) {
    const localCampaignId = campaignMap.get(c.id)
    if (!localCampaignId) continue
    if (c.status === 'ARCHIVED' || c.status === 'DELETED') continue

    if (!campaignsWithMetrics.has(localCampaignId)) {
      const directInsights = await fetchCampaignInsights(c.id, accessToken, {
        datePreset: 'maximum',
      })

      for (const dInsight of directInsights) {
        const metricDate = new Date(dInsight.date)
        const existingMetric = await db.campaignMetric.findFirst({
          where: {
            organizationId: ctx.organizationId,
            clientId: client.id,
            campaignId: localCampaignId,
            date: metricDate,
          },
        })

        if (existingMetric) {
          await db.campaignMetric.update({
            where: { id: existingMetric.id },
            data: {
              impressions: dInsight.impressions,
              clicks: dInsight.clicks,
              spend: dInsight.spend,
              ctr: dInsight.ctr,
              cpc: dInsight.cpc,
              conversions: dInsight.conversions,
              revenue: dInsight.revenue,
              roas: dInsight.roas,
              retrievedAt: new Date(),
              raw: dInsight.raw as any,
            },
          })
        } else {
          await db.campaignMetric.create({
            data: {
              organizationId: ctx.organizationId,
              clientId: client.id,
              campaignId: localCampaignId,
              date: metricDate,
              source: 'META_ADS',
              retrievedAt: new Date(),
              period: 'maximum',
              impressions: dInsight.impressions,
              clicks: dInsight.clicks,
              spend: dInsight.spend,
              ctr: dInsight.ctr,
              cpc: dInsight.cpc,
              conversions: dInsight.conversions,
              revenue: dInsight.revenue,
              roas: dInsight.roas,
              raw: dInsight.raw as any,
            },
          })
        }
        syncedMetrics++
      }
    }
  }

  // 5. Update connection health - stamp the *specific* connection this sync
  // was for, not just "whichever one comes first for this client" (a
  // client can have several Meta Ads connections; see the connectionId
  // parameter above).
  const connectionToStamp = resolvedConnectionId
    ? await db.integrationConnection.findUnique({ where: { id: resolvedConnectionId } })
    : await getProviderConnection(client.id, 'META_ADS')
  if (connectionToStamp) {
    await recordIntegrationSuccess(connectionToStamp.id)
  }

  return {
    syncedCampaigns,
    syncedMetrics,
    adAccountId,
  }
}
