import type { AdsProvider } from '../providers'
import { GoogleAdsMockProvider } from './mock-provider'
import { createGoogleAdsProvider } from './provider'

/**
 * Resolves the AdsProvider to use for Google Ads calls. `GOOGLE_ADS_DEVELOPER_TOKEN`
 * presence is the configuration signal (matching how `isGoogleIntegrationConfigured`
 * gates GA4/GSC) - even when set, `createGoogleAdsProvider()` still throws
 * `UnsupportedOperationError` on every call today (see provider.ts's doc
 * comment for why), so in practice this always resolves to the mock until a
 * real adapter is implemented. Kept as a real resolution step anyway (not a
 * hardcoded mock export) so the shape matches GA4/GSC/Metricool and a future
 * real implementation slots in without touching any call site.
 */
export function resolveGoogleAdsProvider(): AdsProvider {
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.warn('[google_ads] GOOGLE_ADS_DEVELOPER_TOKEN not configured - using GoogleAdsMockProvider.')
    return GoogleAdsMockProvider
  }
  return createGoogleAdsProvider()
}

export { GoogleAdsMockProvider } from './mock-provider'
export { createGoogleAdsProvider } from './provider'
