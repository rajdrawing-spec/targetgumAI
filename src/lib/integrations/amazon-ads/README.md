# integrations/amazon-ads

Native `AdsProvider` adapter for Amazon Advertising (Sponsored Products
only - the highest-volume Amazon ad type, and the one BRD-PRD's own
campaign-creation form already collects fields for). Built the same way as
`google-ads/` - no official Node.js client exists for the Amazon
Advertising API, so this talks to its documented REST interface (v3)
directly.

- `amazon-ads-client.ts` — the real client: Login with Amazon (LWA)
  refresh-token exchange, the `/sp/campaigns`/`/sp/adGroups`/
  `/sp/productAds` list/mutate calls, and the asynchronous Reporting API
  (request a report, poll until generated, download and gunzip it -
  Amazon has no synchronous "get today's stats" endpoint). See the file's
  header comment for the full "not live-verified" caveat - no Amazon
  Advertising API access application/LWA app/test account exists in this
  environment (`docs/EXTERNAL-APPROVALS.md`), so every request/response
  shape follows Amazon's published reference as precisely as possible,
  verified in tests against that shape, never against Amazon's actual
  infrastructure yet.
- `provider.ts` — `createAmazonAdsProvider(accountId?)`, implementing the
  real `AdsProvider` interface. `accountId` exists for the same reason
  Google Ads' does: every Amazon Ads API call is scoped to an advertiser
  profile (sent as the `Amazon-Advertising-API-Scope` header), and the
  shared interface's write methods carry no account-id parameter -
  `tools.ts` supplies it from the connection.
- `mock-provider.ts` — `AmazonAdsMockProvider`, full deterministic
  implementation. What every tool/agent/test exercises when
  `AMAZON_ADS_CLIENT_ID` isn't set.
- `index.ts` — `resolveAmazonAdsProvider(accountId?)`: the real adapter
  once `AMAZON_ADS_CLIENT_ID` is set, otherwise the mock.
- `tools.ts` — registers `amazon_ads.get_campaigns`/`get_campaign_performance`/
  `get_ad_groups`/`get_ads` (LOW), `create_campaign`/`pause_campaign`
  (MEDIUM), `update_campaign`/`update_budget`/`update_bid` (HIGH, Approval
  Engine-gated) - identical risk shape to Google Ads/Meta Ads.
- `connect.ts` — `connectClientToAmazonAdsAccount`, single-step
  connect-and-verify, same shape as Google Ads' (agency-wide credentials,
  nothing per-connection to collect beyond the profile id).

**Auth model, same as Google Ads':** one agency-wide LWA refresh token
(`AMAZON_ADS_REFRESH_TOKEN`) can act on any advertiser profile shared with
that Amazon account - identified per call by its numeric profile id,
which is what `IntegrationConnection.externalAccountId` stores per client.
See `.env.example`'s "Native Ads: Amazon Ads" section for every required
variable (including `AMAZON_ADS_REGION` - Amazon Ads has three separate
regional API endpoints, NA/EU/FE) and `docs/EXTERNAL-APPROVALS.md` for how
to obtain them.

**Scope note:** Sponsored Brands and Sponsored Display are not
implemented - Sponsored Products alone covers the great majority of
Amazon PPC spend and is what the existing "Create Ad Set" form already
has fields for (`AmazonCampaignType`, `src/lib/ads/types.ts`). Either
other ad type would be an additional, near-identical adapter, not a
rewrite of this one, if ever needed.

`ads.manage` is the permission (`src/lib/rbac/permissions.ts`) gating
every write tool above - `employee` (and `super_admin`), not `client`.
Reads use the existing `clients.read` everyone already holds.
