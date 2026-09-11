import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'
import { UnsupportedOperationError } from '../errors'

/**
 * The real Google Ads adapter - every method currently `UnsupportedOperationError`.
 *
 * Unlike GA4/GSC (`src/lib/integrations/ga4/provider.ts`,
 * `src/lib/integrations/gsc/provider.ts`), which wrap the official,
 * already-installed `googleapis` client library, there is no official
 * Node.js client for the Google Ads API at all - Google's own published
 * client-library list (developers.google.com/google-ads/api/docs/
 * client-libs) covers Java/.NET/PHP/Python/Perl/Ruby, not Node.js/
 * TypeScript. Writing a bespoke REST/GAQL client against an unverified
 * protocol shape - developer-token headers, resource names, mutate-operation
 * envelopes - would mean guessing exact wire formats with nothing in this
 * environment to check them against (no developer token, no Google Cloud
 * project, no test account: BRD Section 52; see docs/EXTERNAL-APPROVALS.md).
 * CLAUDE.md rule 5/BRD Section 15/116: never fabricate an implementation
 * that can't be verified - the honest thing here is the same choice already
 * made for `metricool.publish_post`'s real adapter (`src/lib/integrations/
 * metricool/provider.ts`), not a guessed protocol implementation.
 *
 * `GoogleAdsMockProvider` (mock-provider.ts) is what actually implements
 * the full interface and is what every google_ads.* Tool Registry entry,
 * agent, and test exercises today. Once real access exists, replace each
 * method body below with an actual Google Ads API call - the interface and
 * every call site stay unchanged (BRD Section 51: "behind the same
 * AdsProvider interface, so agent code is unchanged").
 */
export function createGoogleAdsProvider(): AdsProvider {
  return {
    async getCampaigns(): Promise<AdCampaignRecord[]> {
      throw new UnsupportedOperationError('google_ads', 'getCampaigns', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async getCampaignPerformance(): Promise<AdCampaignPerformance[]> {
      throw new UnsupportedOperationError('google_ads', 'getCampaignPerformance', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async getAdGroups(): Promise<AdGroupRecord[]> {
      throw new UnsupportedOperationError('google_ads', 'getAdGroups', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async getAds(): Promise<AdRecord[]> {
      throw new UnsupportedOperationError('google_ads', 'getAds', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async createCampaign(): Promise<AdCampaignRecord> {
      throw new UnsupportedOperationError('google_ads', 'createCampaign', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async updateCampaign(): Promise<AdCampaignRecord> {
      throw new UnsupportedOperationError('google_ads', 'updateCampaign', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async pauseCampaign(): Promise<void> {
      throw new UnsupportedOperationError('google_ads', 'pauseCampaign', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async updateBudget(): Promise<void> {
      throw new UnsupportedOperationError('google_ads', 'updateBudget', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async updateBid(): Promise<void> {
      throw new UnsupportedOperationError('google_ads', 'updateBid', 'no verified Google Ads API client - see docs/EXTERNAL-APPROVALS.md')
    },
  }
}
