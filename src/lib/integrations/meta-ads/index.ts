import type { AdsProvider } from '../providers'
import { createMetaAdsProvider } from './provider'

/**
 * Resolves the genuine AdsProvider for Meta Ads API calls.
 */
export function resolveMetaAdsProvider(token?: string): AdsProvider {
  return createMetaAdsProvider(token)
}

export { createMetaAdsProvider } from './provider'
export {
  fetchMetaAdAccounts,
  fetchMetaCampaigns,
  fetchMetaDailyInsights,
  fetchCampaignInsights,
  verifyMetaCredentials,
} from './meta-client'
export { syncMetaAdAccountTelemetry } from './sync'
