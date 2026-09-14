import type { AdsProvider } from '../providers'
import { AmazonAdsMockProvider } from './mock-provider'
import { createAmazonAdsProvider } from './provider'

/**
 * Resolves the AdsProvider to use for Amazon Ads calls.
 * `AMAZON_ADS_CLIENT_ID` presence is the configuration signal (matching
 * `GOOGLE_ADS_DEVELOPER_TOKEN`'s role for Google Ads) - once set, this
 * resolves to the real adapter (`provider.ts`), which talks to the
 * documented Amazon Advertising API v3 directly (no official Node client
 * exists - see provider.ts's doc comment for the "not live-verified"
 * caveat). Until then, every call resolves to the mock.
 *
 * `accountId` is only used by the four write operations
 * (`pauseCampaign`/`updateBudget`/`updateBid`/`updateCampaign`) - every
 * Amazon Ads API call is scoped to an advertiser profile (sent as the
 * `Amazon-Advertising-API-Scope` header), so `amazon-ads/tools.ts` passes
 * the connection's `externalAccountId` (the profile id) here when it
 * builds a provider for one of those calls. The four read operations
 * don't need it (they already take the profile id as an explicit per-call
 * argument).
 */
export function resolveAmazonAdsProvider(accountId?: string): AdsProvider {
  if (!process.env.AMAZON_ADS_CLIENT_ID) {
    console.warn('[amazon_ads] AMAZON_ADS_CLIENT_ID not configured - using AmazonAdsMockProvider.')
    return AmazonAdsMockProvider
  }
  return createAmazonAdsProvider(accountId)
}

export { AmazonAdsMockProvider } from './mock-provider'
export { createAmazonAdsProvider } from './provider'
