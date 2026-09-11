import type { AdCampaignPerformance, AdCampaignRecord, AdGroupRecord, AdRecord, AdsProvider } from '../providers'
import { UnsupportedOperationError } from '../errors'

/**
 * The real Meta Ads adapter - every method currently `UnsupportedOperationError`.
 *
 * Unlike Google Ads (`../google-ads/provider.ts`'s doc comment - no
 * official Node client exists at all), Meta *does* publish an official
 * Node SDK (`facebook-nodejs-business-sdk`). It is deliberately not added
 * as a dependency here: writing correct calls against it would mean
 * guessing its exact method/class surface (this package is not installed
 * in this project and its API can't be inspected from this environment),
 * and there is nothing to verify a guess against either way - no Meta
 * developer app, no app review, no test ad account exist in this
 * environment (BRD Section 54; see docs/EXTERNAL-APPROVALS.md). Adding an
 * unverified dependency and writing unverifiable calls against it isn't
 * meaningfully safer than guessing a raw REST shape, and CLAUDE.md rule
 * 5/BRD Section 15/116 rule out both - same choice already made for
 * `metricool.publish_post`'s real adapter.
 *
 * `MetaAdsMockProvider` (mock-provider.ts) is what actually implements the
 * full interface and is what every meta_ads.* Tool Registry entry, agent,
 * and test exercises today. Once real access exists (a Meta developer app
 * that has passed the relevant app review), replace each method body below
 * with an actual `facebook-nodejs-business-sdk` call - the interface and
 * every call site stay unchanged (BRD Section 51).
 */
export function createMetaAdsProvider(): AdsProvider {
  return {
    async getCampaigns(): Promise<AdCampaignRecord[]> {
      throw new UnsupportedOperationError('meta_ads', 'getCampaigns', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async getCampaignPerformance(): Promise<AdCampaignPerformance[]> {
      throw new UnsupportedOperationError('meta_ads', 'getCampaignPerformance', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async getAdGroups(): Promise<AdGroupRecord[]> {
      throw new UnsupportedOperationError('meta_ads', 'getAdGroups', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async getAds(): Promise<AdRecord[]> {
      throw new UnsupportedOperationError('meta_ads', 'getAds', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async createCampaign(): Promise<AdCampaignRecord> {
      throw new UnsupportedOperationError('meta_ads', 'createCampaign', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async updateCampaign(): Promise<AdCampaignRecord> {
      throw new UnsupportedOperationError('meta_ads', 'updateCampaign', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async pauseCampaign(): Promise<void> {
      throw new UnsupportedOperationError('meta_ads', 'pauseCampaign', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async updateBudget(): Promise<void> {
      throw new UnsupportedOperationError('meta_ads', 'updateBudget', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
    async updateBid(): Promise<void> {
      throw new UnsupportedOperationError('meta_ads', 'updateBid', 'no verified Meta Marketing API client - see docs/EXTERNAL-APPROVALS.md')
    },
  }
}
