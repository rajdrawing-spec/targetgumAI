import type { AdsProvider } from '../providers'
import { GoogleAdsMockProvider } from './mock-provider'
import { createGoogleAdsProvider } from './provider'

/**
 * Resolves the AdsProvider to use for Google Ads calls.
 * `GOOGLE_ADS_DEVELOPER_TOKEN` presence is the configuration signal
 * (matching how `isGoogleIntegrationConfigured` gates GA4/GSC) - once set,
 * this resolves to the real adapter (`provider.ts`), which talks to the
 * documented Google Ads API v18 REST/GAQL interface directly (no official
 * Node client exists - see provider.ts's doc comment for the "not
 * live-verified" caveat). Until then, every call resolves to the mock.
 *
 * `accountId` is only used by the four write operations
 * (`pauseCampaign`/`updateBudget`/`updateBid`/`updateCampaign`) - unlike
 * Meta's globally-addressable campaign ids, every Google Ads API call is
 * scoped to a customer account in the URL itself, so `google-ads/tools.ts`
 * passes the connection's `externalAccountId` here when it builds a
 * provider for one of those calls. The four read operations don't need it
 * (they already take the account id as an explicit per-call argument).
 */
export function resolveGoogleAdsProvider(accountId?: string): AdsProvider {
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.warn('[google_ads] GOOGLE_ADS_DEVELOPER_TOKEN not configured - using GoogleAdsMockProvider.')
    return GoogleAdsMockProvider
  }
  return createGoogleAdsProvider(accountId)
}

export { GoogleAdsMockProvider } from './mock-provider'
export { createGoogleAdsProvider } from './provider'
