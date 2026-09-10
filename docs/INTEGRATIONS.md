# Integrations — TargetGum AI Marketing OS

Status: **Design draft.** No provider adapters are implemented yet (Week 2 of
`docs/MVP-CHECKLIST.md`). This document records the provider interface contracts and
integration model so implementation is straightforward once the foundation lands.

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
| AI reasoning | Claude | Not yet implemented (Day 4) |
| Social scheduling / analytics | Metricool MCP | Not yet implemented (Week 2) |
| Supported ad analysis / management | Metricool MCP | Not yet implemented (Week 2); **exact write operations must be verified against the live Metricool MCP tool list before any production automation depends on them** |
| Website analytics | GA4 | Not yet implemented (Week 2) |
| Search analytics | Google Search Console | Not yet implemented (Week 2) |
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
`MetricoolProvider` adapter (Week 2) wraps exactly the confirmed-available
operations above; the mock (`MetricoolMockProvider`) still implements the full
`AdsProvider` write methods (no-ops) so agent/workflow code and its tests are
unaffected if a future provider (Metricool or native) adds write support.

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
