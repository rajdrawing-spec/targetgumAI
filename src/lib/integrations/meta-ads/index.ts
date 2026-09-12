import type { AdsProvider } from '../providers'
import { createMetaAdsProvider } from './provider'

/**
 * Resolves the genuine AdsProvider for Meta Ads API calls.
 */
export function resolveMetaAdsProvider(): AdsProvider {
  return createMetaAdsProvider()
}

export { createMetaAdsProvider } from './provider'
export {
  fetchMetaAdAccounts,
  fetchMetaCampaigns,
  fetchMetaDailyInsights,
  verifyMetaCredentials,
} from './meta-client'
export { syncMetaAdAccountTelemetry } from './sync'
