# integrations/meta-ads

Native `AdsProvider` adapter for Meta Ads (Phase 2, BRD Section 51/85) -
mirrors `../google-ads/` in shape, but this one is a genuine, live Graph API
client (not a mock-only stub) - see docs/DECISIONS.md.

- `meta-client.ts` — direct HTTPS calls to Meta's Graph API (`metaFetch`):
  credential verification, ad accounts, campaigns, daily insights, and the
  write operations (create/pause/resume/update budget). Graph API version
  is `META_GRAPH_API_VERSION` (env, defaults to a recent version) - Meta
  sunsets each version ~2 years after release, so this needs periodic
  review, not a hardcoded string. Retries Meta's own transient/rate-limit
  error codes with backoff; never retries a genuine 4xx.
- `provider.ts` — `createMetaAdsProvider()`, the real `AdsProvider` adapter
  wrapping `meta-client.ts` to the shape every tool/agent expects.
- `mock-provider.ts` — `MetaAdsMockProvider`, full deterministic
  implementation (BRD Section 92), exercised directly by unit tests. Not
  wired into `resolveMetaAdsProvider()` - the real adapter throws a clear
  "not configured" error (surfaced as `IntegrationUnavailableError`, never
  fabricated data) when `META_ACCESS_TOKEN` is missing.
- `index.ts` — `resolveMetaAdsProvider()`: the real adapter.
- `sync.ts` — `syncMetaAdAccountTelemetry`, pulls live campaigns + insights
  into the local DB. Always requests a bounded (last-90-day) daily-insights
  window - Meta rejects a daily breakdown spanning more than 90 days, so
  requesting `date_preset=maximum` there is a guaranteed failure once an
  account has any real history.
- `schedule.ts` / `../../../app/api/cron/meta-ads-sync/route.ts` — daily
  automated refresh for every connected account.
- `tools.ts` — registers `meta_ads.get_campaigns`/`get_campaign_performance`/
  `get_ad_groups`/`get_ads` (LOW), `create_campaign`/`pause_campaign`
  (MEDIUM), `update_campaign`/`update_budget`/`update_bid` (HIGH, Approval
  Engine-gated).
- `connect.ts` — `connectClientToMetaAdsAccount`, single-step
  connect-and-verify (same shape as Metricool/Google Ads).

Same `ads.manage` permission as Google Ads gates every write tool here too.
