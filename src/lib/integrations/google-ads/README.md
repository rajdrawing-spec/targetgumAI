# integrations/google-ads

Native `AdsProvider` adapter for Google Ads (Phase 2, BRD Section 51/85) -
closes the "ad management (write)" gap `docs/INTEGRATIONS.md` documents as
confirmed unavailable via Metricool.

- `google-ads-client.ts` — the real Google Ads API (v18) REST/GAQL client:
  OAuth2 refresh-token exchange, GAQL search, and the `campaigns:mutate`/
  `campaignBudgets:mutate`/`adGroups:mutate` calls. There is no official
  Node.js client for the Google Ads API (unlike GA4/GSC's `googleapis`), so
  this talks to the documented REST interface directly - see the file's own
  header comment for the full "not live-verified" caveat: no developer
  token/OAuth client/test account exists in this environment
  (`docs/EXTERNAL-APPROVALS.md`), so every request/response shape follows
  Google's published reference as precisely as possible, verified in tests
  against that shape, but never against Google's actual infrastructure yet.
- `provider.ts` — `createGoogleAdsProvider(accountId?)`, implementing the
  real `AdsProvider` interface against the client above. `accountId` exists
  because every Google Ads API call is scoped to a customer account in the
  URL itself (unlike Meta's globally-addressable campaign ids) - the four
  write methods need it and the shared interface has no room to pass it
  per-call, so it's a factory argument instead (same shape Meta's
  `createMetaAdsProvider(token)` uses for its own per-call context).
  `tools.ts` supplies it from the connection.
- `mock-provider.ts` — `GoogleAdsMockProvider`, full deterministic
  implementation (BRD Section 92 names this explicitly). What every tool,
  agent, and test exercises when `GOOGLE_ADS_DEVELOPER_TOKEN` isn't set.
- `index.ts` — `resolveGoogleAdsProvider(accountId?)`: the real adapter once
  `GOOGLE_ADS_DEVELOPER_TOKEN` is set, otherwise the mock.
- `tools.ts` — registers `google_ads.get_campaigns`/`get_campaign_performance`/
  `get_ad_groups`/`get_ads` (LOW), `create_campaign`/`pause_campaign`
  (MEDIUM), `update_campaign`/`update_budget`/`update_bid` (HIGH, Approval
  Engine-gated). The four write tools pass `connection.integrationAccount.
  externalAccountId` into `resolveGoogleAdsProvider(...)` so the real
  adapter knows which customer account to act on.
- `connect.ts` — `connectClientToGoogleAdsAccount`, a single-step
  connect-and-verify (Metricool's shape, not GA4/GSC's unwired OAuth flow -
  see the file's own doc comment for why).

**Auth model, unlike Meta's:** Google Ads authenticates once per *manager*
(MCC) account, not per client - one agency-wide OAuth refresh token
(`GOOGLE_ADS_REFRESH_TOKEN`) plus `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (the
manager account, sent as the `login-customer-id` header) can act on any
client account linked under that manager, identified per call by its own
customer id (`externalAccountId` on the `IntegrationConnection`). There is
nothing per-client to store beyond that customer id - see `.env.example`'s
"Native Ads: Google Ads" section for every required variable and
`docs/EXTERNAL-APPROVALS.md` for how to obtain them.

`ads.manage` is the permission (`src/lib/rbac/permissions.ts`) gating
every write tool above - `employee` (and `super_admin`), not `client`
(BRD 4.3/4.4 only lists "Analyze campaigns"/read-only for client-side
roles). Reads use the existing `clients.read` everyone already holds.
