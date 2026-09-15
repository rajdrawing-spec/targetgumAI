import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { executeTool } from '@/lib/tools/execute'
import type { AdCampaignRecord } from '@/lib/integrations/ads-schemas'
import type { AdCampaignProvider } from './connected-providers'
import type { CampaignBrief } from './campaign-brief'

/**
 * Turns a reviewed, human-confirmed campaign brief into a real campaign -
 * the guided wizard's final step. Calls the real per-provider
 * `{provider}.create_campaign` tool (MEDIUM risk - executes immediately,
 * always returns the campaign PAUSED, per every adapter's own invariant -
 * BRD Section 21: "create draft campaign" is default-automatic; actually
 * activating it is a separate, HIGH-risk step already gated by
 * `src/lib/ads/service.ts`'s `toggleCampaignStatus`) through the same
 * `executeTool` chain every other write in this app goes through - never
 * the old local-only `ads/service.ts` `createCampaign`, which fabricated
 * a fake providerCampaignId and never touched a real ad platform (removed
 * alongside this - see docs/DECISIONS.md).
 *
 * The resulting local `Campaign` row is upserted from the tool's real
 * response, the same shape `src/lib/integrations/meta-ads/sync.ts` already
 * upserts from live Meta API data - a wizard-launched campaign is
 * indistinguishable in the database from one a sync discovered, exactly as
 * intended.
 */

const CREATE_CAMPAIGN_TOOL: Record<AdCampaignProvider, string> = {
  META_ADS: 'meta_ads.create_campaign',
  GOOGLE_ADS: 'google_ads.create_campaign',
  AMAZON_ADS: 'amazon_ads.create_campaign',
}

const DEFAULT_CHANNEL: Record<AdCampaignProvider, string> = {
  META_ADS: 'Meta Ads - Facebook & Instagram',
  GOOGLE_ADS: 'Google Ads - Search',
  AMAZON_ADS: 'Amazon Sponsored Products',
}

export interface LaunchCampaignInput {
  ctx: AuthContext
  clientId: string
  provider: AdCampaignProvider
  name: string
  dailyBudget: number
  adConcept: CampaignBrief['adConcept']
  /** The AiRun that produced the brief being launched - carried onto the tool call and the creative asset for traceability. */
  aiRunId?: string
}

export interface LaunchCampaignResult {
  campaignId: string
  providerCampaignId: string
  status: string
  creativeAssetId: string
}

export async function launchCampaignFromWizard(input: LaunchCampaignInput): Promise<LaunchCampaignResult> {
  const { ctx, clientId, provider, name, dailyBudget, adConcept, aiRunId } = input

  assertPermission(ctx, 'ads.manage')
  await getAuthorizedClient(ctx, clientId)

  const record = (await executeTool({
    ctx,
    toolKey: CREATE_CAMPAIGN_TOOL[provider],
    clientId,
    input: { name, budget: dailyBudget },
    aiRunId,
  })) as AdCampaignRecord

  const campaign = await db.campaign.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      provider,
      providerCampaignId: record.providerCampaignId,
      name: record.name,
      channel: record.channel || DEFAULT_CHANNEL[provider],
      status: record.status ?? 'PAUSED',
      budget: record.budget ?? dailyBudget,
      startDate: record.startDate ? new Date(record.startDate) : new Date(),
    },
  })

  const creativeAsset = await db.creativeAsset.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      campaignId: campaign.id,
      platform: provider,
      provider,
      concept: adConcept.visualDirection,
      copy: `${adConcept.headline}\n\n${adConcept.primaryText}`,
      status: 'DRAFT',
      createdBy: ctx.userId,
    },
  })

  return {
    campaignId: campaign.id,
    providerCampaignId: campaign.providerCampaignId,
    status: campaign.status ?? 'PAUSED',
    creativeAssetId: creativeAsset.id,
  }
}
