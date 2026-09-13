# integrations/google-ads

Native `AdsProvider` adapter for Google Ads (Phase 2, BRD Section 51/85) -
closes the "ad management (write)" gap `docs/INTEGRATIONS.md` documents as
confirmed unavailable via Metricool.

- `mock-provider.ts` — `GoogleAdsMockProvider`, full deterministic
  implementation (BRD Section 92 names this explicitly). What every tool,
  agent, and test in this codebase actually exercises today.
- `provider.ts` — the real adapter, `createGoogleAdsProvider()`. Every
  method throws `UnsupportedOperationError` - there is no official Node.js
  client for the Google Ads API (unlike GA4/GSC's `googleapis`), and a
  developer token/Google Cloud project/OAuth app is required before any
  real call is even possible (BRD Section 52). See the file's own doc
  comment and `docs/EXTERNAL-APPROVALS.md`.
- `index.ts` — `resolveGoogleAdsProvider()`: real adapter when
  `GOOGLE_ADS_DEVELOPER_TOKEN` is set (which still throws today, per
  above), otherwise the mock.
- `tools.ts` — registers `google_ads.get_campaigns`/`get_campaign_performance`/
  `get_ad_groups`/`get_ads` (LOW), `create_campaign`/`pause_campaign`
  (MEDIUM), `update_campaign`/`update_budget`/`update_bid` (HIGH, Approval
  Engine-gated).
- `connect.ts` — `connectClientToGoogleAdsAccount`, a single-step
  connect-and-verify (Metricool's shape, not GA4/GSC's unwired OAuth flow -
  see the file's own doc comment for why).

`ads.manage` is the permission (`src/lib/rbac/permissions.ts`) gating
every write tool above - `employee` (and `super_admin`), not `client`
(BRD 4.3/4.4 only lists "Analyze campaigns"/read-only for client-side
roles). Reads use the existing `clients.read` everyone already holds.
