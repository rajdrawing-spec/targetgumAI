import type { AdsProvider } from '../providers'
import { MetaAdsMockProvider } from './mock-provider'
import { createMetaAdsProvider } from './provider'

/**
 * Resolves the AdsProvider to use for Meta Ads calls. `META_ADS_APP_ID`
 * presence is the configuration signal (mirrors `resolveGoogleAdsProvider`'s
 * `GOOGLE_ADS_DEVELOPER_TOKEN` check) - even when set, `createMetaAdsProvider()`
 * still throws `UnsupportedOperationError` on every call today (see
 * provider.ts's doc comment for why), so in practice this always resolves
 * to the mock until a real adapter is implemented.
 */
export function resolveMetaAdsProvider(): AdsProvider {
  if (!process.env.META_ADS_APP_ID) {
    console.warn('[meta_ads] META_ADS_APP_ID not configured - using MetaAdsMockProvider.')
    return MetaAdsMockProvider
  }
  return createMetaAdsProvider()
}

export { MetaAdsMockProvider } from './mock-provider'
export { createMetaAdsProvider } from './provider'
