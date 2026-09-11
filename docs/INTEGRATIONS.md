# Integrations — TargetGum AI Marketing OS

Status: **Metricool (Day 6) and GA4/GSC (Day 7) implemented; Metricool's analytics
parsing corrected against real live data (Day 15).** Provider interfaces
(`src/lib/integrations/providers.ts`), the connection/health model
(`src/lib/integrations/health.ts`), and real + mock adapters for Metricool
(`src/lib/integrations/metricool/`), GA4 (`.../ga4/`), and GSC (`.../gsc/`) all exist.
Canva remains design-only (Phase 1, optional). Day 15 also verified the Metricool
adapter against this session's own live MCP connection (not just documented schemas)
and found + fixed a real parsing bug - see "`getAnalyticsDataByMetrics` real response
shape" below.

## Principle: Provider Abstraction (BRD-PRD Section 109-112)

Agents and application code never branch on a specific vendor. They call a
`*Provider` interface; a concrete adapter (Metricool, Canva, GA4, GSC, and
later Meta/Google Ads/Amazon Ads) implements it.

```text
Agent → TargetGum Tool → Provider Interface → Vendor Adapter (real or mock) → Vendor
```

Every provider ships with a **mock implementation** from day one (BRD Section
92) so workflows are testable before real credentials/approvals exist.

## Integration Model (BRD-PRD Section 33)

```text
Client → Integration → Integration Account → OAuth Connection / Credential
```

This lets one client have multiple Google Ads accounts, multiple Meta ad
accounts, multiple social profiles, multiple Metricool brands, etc. Health is
tracked per connection: `CONNECTED | DEGRADED | AUTH_REQUIRED | ERROR |
DISCONNECTED`, with last successful sync and last error surfaced on the
integrations dashboard (BRD Section 34).

## Provider Interfaces

```typescript
interface SocialProvider {
  getConnectedNetworks(): Promise<...>
  createPost(input): Promise<...>
  schedulePost(input): Promise<...>
  publishPost(input): Promise<...>
  getPosts(input): Promise<...>
  getAnalytics(input): Promise<...>
}

interface AdsProvider {
  getCampaigns(input): Promise<...>
  getCampaignPerformance(input): Promise<...>
  getAdGroups(input): Promise<...>
  getAds(input): Promise<...>
  createCampaign(input): Promise<...>
  updateCampaign(input): Promise<...>
  pauseCampaign(input): Promise<...>
  updateBudget(input): Promise<...>
  updateBid(input): Promise<...>
}

interface CreativeProvider {
  createDesign(input): Promise<...>
  editDesign(input): Promise<...>
  searchDesigns(input): Promise<...>
  searchAssets(input): Promise<...>
  exportDesign(input): Promise<...>
}

interface AnalyticsProvider {
  getReport(input): Promise<...>   // GA4
}

interface SEOProvider {
  getSearchPerformance(input): Promise<...>  // GSC
}
```

Full input/output Zod schemas are defined alongside each adapter when
implemented, not speculatively here.

## MVP Provider Matrix (BRD-PRD Section 110)

| Capability | MVP Provider | Status |
|---|---|---|
| AI reasoning | Claude | Implemented (Day 4) - orchestration verified, live API call pending a key |
| Social scheduling / analytics | Metricool MCP | Implemented (Day 6), analytics parsing corrected against real response data (Day 15) - adapter unit-tested against the verified live shape; the deployed app itself still has no `METRICOOL_MCP_URL` of its own, so wire-level connectivity from the app is not live-tested |
| Supported ad analysis (read) | Metricool MCP | Implemented (Day 6), same real-shape fix and live-test caveat as above; the `campaigns` connector's exact shape is inferred from the verified `evolution` connector, not independently confirmed (no populated ads account available) |
| Ad management (write) | Native Google Ads / Meta Ads (Phase 2) | **Implemented (Day 16/Phase 2)** via `GoogleAdsMockProvider`/`MetaAdsMockProvider` - confirmed unavailable via Metricool (capability gap in the MCP itself), so this is a separate `AdsProvider` implementation, not a Metricool fix. Real adapters are `UnsupportedOperationError` (no verified client library for either platform in this environment) - see below and docs/EXTERNAL-APPROVALS.md |
| Website analytics | GA4 | Implemented (Day 7) via official `googleapis` client; not live-tested (no OAuth app configured) |
| Search analytics | Google Search Console | Implemented (Day 7), same caveat as above |
| Creative | Canva MCP | Optional; not yet implemented |

### Metricool MCP — availability confirmed (checked live, 2026-09-10)

This environment has a live `Metricool_Social_Media_Management` MCP connection
(account `info@tapashub.com`) exposing: `createScheduledPost`,
`createScheduledPostForReview`, `getAnalyticsAvailableMetrics`,
`getAnalyticsDataByMetrics`, `getBestTimeToPostByNetwork`, `getBrandSettings`,
`getScheduledPosts`, `sendScheduledPostForReview`, `updateScheduledPost`.

**Confirmed via `getBrandSettings` + `getAnalyticsAvailableMetrics`:**

- **Social** (`SocialProvider`): scheduling/publishing and analytics tools are
  present and map cleanly to `getPosts`/`schedulePost`/`publishPost`/
  `getAnalytics`.
- **Ads analysis** (`AdsProvider.getCampaignPerformance` — read only):
  available. `getAnalyticsDataByMetrics` supports `network` values `googleAds`,
  `metaAds`, `facebookAds`, `tiktokAds` with a full metrics schema (spend,
  impressions, clicks, conversions, CPC, CPM, CTR, ROAS) at both
  account-evolution and per-campaign granularity — sufficient for the MVP
  "Analyze Client A's ads performance" workflow.
- **Ads management** (`AdsProvider.createCampaign`/`updateCampaign`/
  `pauseCampaign`/`updateBudget`/`updateBid` — write): **not available.** No
  ads-equivalent write endpoints exist in this MCP's tool list at all (only
  the social scheduling writes above). This is a capability gap in the MCP
  server itself, not an account-plan restriction — per BRD Section 15/111, a
  native `GoogleAdsProvider`/`MetaAdsProvider` (Phase 2) is the path if ads
  write/optimization is ever required. It does not block MVP: BRD Section 19
  already scopes the MVP ads workflow to read-only analysis.
- **Connected brands** (5): HUGFAB, LHO (Facebook Ads connected), TargetGum,
  undertreegames (Facebook Ads connected), Pepalworks. No brand currently has
  a Google Ads account connected in Metricool — Google Ads metrics/campaign
  connectors exist in the schema but there's no populated account to read
  from yet for any of these brands.

Full findings and implications are logged in `docs/DECISIONS.md`. The
`MetricoolProvider` adapter wraps exactly the confirmed-available operations above;
the mock (`MetricoolMockProvider`) still implements the full `AdsProvider` write
methods (no-ops) so agent/workflow code and its tests are unaffected if a future
provider (Metricool or native) adds write support.

### Metricool adapter — implementation notes (Day 6)

- **Registered tools** (`src/lib/integrations/metricool/tools.ts`, Tool Registry):
  `metricool.get_connected_networks`, `metricool.get_posts`,
  `metricool.schedule_post` (MEDIUM risk), `metricool.get_social_analytics`,
  `metricool.get_ad_campaigns`, `metricool.get_ad_performance` (all LOW risk except
  scheduling). `metricool.update_ad_campaign` is deliberately not registered — see
  above.
- **Safety invariant**: `schedulePost`/`createPost` always send `draft: true` to
  Metricool. Nothing this adapter does can cause a real-world publish — a distinct
  future `publishPost`-equivalent would need to be its own HIGH-risk,
  Approval-Engine-gated tool. See docs/DECISIONS.md.
- **`getPosts` gap**: only returns *scheduled* (not-yet-published) posts —
  `getScheduledPosts` is the only verified read tool for post listings; there's no
  verified tool for published-post history.
- **Connection model**: `src/lib/integrations/health.ts` implements Client →
  Integration → IntegrationAccount → IntegrationConnection (BRD Section 33) generically
  (any provider, not just Metricool), with health tracking (BRD Section 34) — every
  Metricool tool call resolves and records against a real `IntegrationConnection`, and
  refuses to run (raising `IntegrationUnavailableError`, never fabricating data) if a
  client has no connection or the connection isn't `CONNECTED`.
- **Not live-verified for writes/wire-level connectivity**: no `METRICOOL_MCP_URL`/
  `METRICOOL_API_KEY` is configured in the *deployed app's* environment. The adapter's
  request-building logic (which tool, which arguments, the `draft: true` safety
  invariant) is unit-tested against an injected fake MCP client. See
  docs/EXTERNAL-APPROVALS.md.

### `getAnalyticsDataByMetrics` real response shape — found and fixed (Day 15)

This session's own live `Metricool_Social_Media_Management` MCP connection (the same
one used for the Day 1 schema check above) made it possible to verify `getAnalytics`/
`getCampaigns`/`getCampaignPerformance` against **real returned data**, not just
documented schemas — and that surfaced a real, previously undetected bug.

**What was assumed** (from documentation alone, Day 6): `getAnalyticsDataByMetrics`
returns a `fieldId`-keyed object of numeric values, e.g. `{ "IGEV01": 170 }`.

**What it actually returns** (verified live against brand `TargetGum`, id `6818704`,
network `instagram`, connector `evolution`):

```json
{ "rows": [["170.0", "0.0", null, null, "20260831"], ["169.0", "0.0", null, null, "20260907"]] }
```

One row **per date** in the range, values **positional** (same order as the requested
`metrics` array), numbers as **strings**, `null` for a day with no data, and a
**trailing `YYYYMMDD` date string** appended after the requested metrics.

**Impact before the fix**: `getAnalytics`'s field-mapping loop did `Object.entries(data)`
on `{rows: [...]}`, which yields one `["rows", <array>]` entry — the loop was a no-op,
so every normalized field (`reach`, `impressions`, `engagement`, etc.) came back
`undefined` on every call, silently. `getCampaigns` checked `Array.isArray(data)`,
which is `false` for `{rows: [...]}`, so it always returned `[]`. `getCampaignPerformance`
wrapped the whole `{rows: [...]}` object as a single fake row, producing one bogus
record with `providerCampaignId: "unknown"` and no metrics. None of this threw or
failed validation — the Zod output schemas mark every metric field `.optional()`, so
empty/wrong data passed through the Tool Registry silently. This would have made the
MVP's core "Analyze Client A" workflow run against a *real* Metricool connection and
produce a report with no real numbers in it, while looking like it succeeded.

**Fix** (`src/lib/integrations/metricool/provider.ts`): `parseMetricRows` now parses
the real `{rows: [[...]]}` shape - positional values matched back to their requested
`fieldId`, a `numericField`/`stringField` helper per row (campaign *names* are
strings, not numbers - a second latent bug the original code's `typeof x === 'number'`
guard would have masked identically), and the trailing date parsed into `period`.
`getAnalytics` now returns one `SocialMetricValue` per date (a genuine time series)
rather than an artificial single aggregate. Also added: "interactions" (Metricool's
real field name for Instagram engagement, seen live) now maps to the normalized
`engagement` field, alongside the pre-existing "engagement" substring match.

**Still not independently verified**: the `campaigns` connector (used by
`getCampaigns`/`getCampaignPerformance`) is assumed to share the same `{rows: [[...]]}`
wire shape as the verified `evolution` connector (same underlying tool) but was not
independently tested live - no brand with a connected, populated ads account was
available (docs/EXTERNAL-APPROVALS.md). Locked in by
`tests/unit/metricool-provider.test.ts`'s new real-shape test cases either way, so a
future regression back toward the old (wrong) assumption fails loudly.

### GA4 / GSC adapter — implementation notes (Day 7)

- **OAuth, not an API key**: unlike Metricool, GA4/GSC credentials are per-client
  (each client's Google property is authorized separately via OAuth2, `access_type:
  offline` + `prompt: consent` to guarantee a refresh token). Stored refresh tokens
  are envelope-encrypted (`saveProviderCredentials`/`loadProviderCredentials` in
  `src/lib/integrations/health.ts`, reusing Day 3's `src/lib/crypto/envelope.ts`).
- **Registered tools**: `ga4.get_report` (dimensions/metrics/date range → normalized
  rows with provenance), `gsc.get_search_performance` (query/page/date/country/device
  dimensions → clicks/impressions/CTR/position). Both LOW risk (read-only).
- **Provider resolution is per-connection**, not per-organization — see
  docs/DECISIONS.md for why this differs from Metricool's pattern and what it means
  for `withIntegrationHealthTracking`.
- **Not live-verified**: no real Google Cloud OAuth app, GA4 property, or Search
  Console property is configured in any environment this code has run in. The API
  client usage was checked against the installed `googleapis` package's own type
  definitions (not guessed), but the actual OAuth consent flow and API calls haven't
  been exercised against real Google infrastructure. See docs/EXTERNAL-APPROVALS.md.
- **No consent-flow UI yet** — connecting a client's Google account is a library-only
  mechanism (`buildGoogleAuthUrl`/`exchangeGoogleAuthCode` in
  `src/lib/integrations/google/oauth.ts`) with no "Connect Google" button; that's
  Day 13 (dashboard).

## Canva

Optional in MVP. The `CreativeProvider` must degrade gracefully across
`Canva connected | Canva not connected | Canva authorization expired | Canva
unavailable` states (BRD Section 55) — never a hard dependency for the rest
of the app.

## Failure Handling (BRD-PRD Section 56)

- Provider call fails → return `"Integration unavailable. Last successful
  data: <timestamp>."` Never fabricate a substitute value.
- Claude call fails → retry where safe, record the failure, allow manual
  retry.
- Tool execution fails after approval → mark `FAILED`; do not automatically
  repeat a destructive action without an idempotency check confirming it
  didn't already partially succeed.

## Native API Roadmap (Phase 2+, BRD-PRD Section 51-54)

Metricool remains the first operational layer. Native Google Ads / Meta /
Amazon Ads integrations are added only when Metricool lacks a required
operation, more granular control is needed, or provider policy requires
direct integration — behind the same `AdsProvider` interface, so agent code
is unchanged.

### Google Ads / Meta Ads — implemented against the mock (Phase 2, Day 16)

Metricool's ads-write gap (above) was exactly the trigger Section 51
describes, so `src/lib/integrations/google-ads/` and `src/lib/integrations/
meta-ads/` were built, identical in shape:

- **Registered tools**: `google_ads.*`/`meta_ads.*` -
  `get_campaigns`/`get_campaign_performance`/`get_ad_groups`/`get_ads` (LOW,
  `clients.read`), `create_campaign`/`pause_campaign` (MEDIUM, new
  `ads.manage` permission), `update_campaign`/`update_budget`/`update_bid`
  (HIGH, `ads.manage`, Approval Engine-gated).
- **`GoogleAdsMockProvider`/`MetaAdsMockProvider`** (BRD Section 92) are
  full, deterministic implementations - what every tool/test actually
  exercises. `createCampaign` always returns `PAUSED`, same safety
  reasoning as Metricool's `draft: true`.
- **Real adapters are `UnsupportedOperationError`** for every method -
  unlike GA4/GSC (which wrap the official, already-installed `googleapis`
  client), there is no official Node.js client for the Google Ads API at
  all, and Meta's official SDK (`facebook-nodejs-business-sdk`) is
  deliberately not added as an unverified dependency - no developer
  token/Google Cloud project/OAuth app (Google Ads, Section 52) and no
  Meta developer app/app review/test account (Meta, Section 54) exist in
  this environment to check an implementation against either way. Same
  choice already made for `metricool.publish_post`'s real adapter. See
  docs/DECISIONS.md and docs/EXTERNAL-APPROVALS.md.
- **Connect flow**: single-step connect-and-verify (`connectClientToGoogleAdsAccount`/
  `connectClientToMetaAdsAccount`), matching Metricool's shape rather than
  GA4/GSC's OAuth flow - that OAuth scaffold was built on Day 7 but never
  wired to any route or UI either, so replicating it here would add a
  second unexercised flow, not a working one.
- **Not live-verified**: no real Google Ads/Meta Ads credentials exist in
  this environment. Live-verified via Playwright: connected Client A to a
  mock Google Ads customer id and mock Meta Ads account id through the
  client detail page's new forms, confirmed both show `CONNECTED`,
  cross-checked against the database.
