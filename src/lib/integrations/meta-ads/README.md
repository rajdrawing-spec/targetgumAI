# integrations/meta-ads

Native `AdsProvider` adapter for Meta Ads (Phase 2, BRD Section 51/85) -
mirrors `../google-ads/` exactly in shape.

- `mock-provider.ts` — `MetaAdsMockProvider`, full deterministic
  implementation (BRD Section 92 names this explicitly). What every tool,
  agent, and test in this codebase actually exercises today.
- `provider.ts` — the real adapter, `createMetaAdsProvider()`. Every method
  throws `UnsupportedOperationError`. Unlike Google Ads, Meta *does* publish
  an official Node SDK (`facebook-nodejs-business-sdk`) - deliberately not
  added as a dependency: no Meta developer app/app review/test account
  exists in this environment to verify calls against (BRD Section 54), so
  writing code against an uninspectable package would be as unverifiable as
  guessing a raw protocol. See the file's own doc comment and
  `docs/EXTERNAL-APPROVALS.md`.
- `index.ts` — `resolveMetaAdsProvider()`: real adapter when
  `META_ADS_APP_ID` is set (still throws today, per above), otherwise the
  mock.
- `tools.ts` — registers `meta_ads.get_campaigns`/`get_campaign_performance`/
  `get_ad_groups`/`get_ads` (LOW), `create_campaign`/`pause_campaign`
  (MEDIUM), `update_campaign`/`update_budget`/`update_bid` (HIGH, Approval
  Engine-gated).
- `connect.ts` — `connectClientToMetaAdsAccount`, single-step
  connect-and-verify (same shape as Metricool/Google Ads).

Same `ads.manage` permission as Google Ads gates every write tool here too.
