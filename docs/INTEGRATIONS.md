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

### Metricool MCP — availability check performed at session start

This session already has a live `Metricool_Social_Media_Management` MCP
connection with these tools exposed: `createScheduledPost`,
`createScheduledPostForReview`, `getAnalyticsAvailableMetrics`,
`getAnalyticsDataByMetrics`, `getBestTimeToPostByNetwork`,
`getBrandSettings`, `getScheduledPosts`, `sendScheduledPostForReview`,
`updateScheduledPost`. This confirms *some* Metricool MCP surface is
reachable in this environment, but:

- It is not yet confirmed that this connection is scoped to a TargetGum
  brand/account intended for the pilot client (see open question).
- Ads-related read/write operations (campaigns, budgets, bids) are **not**
  present in this tool list — only social scheduling/analytics and brand
  settings. If Metricool ads functionality is required for the MVP
  "Analyze Client A" workflow, this needs to be confirmed against the actual
  Metricool account's plan/permissions before the AdsProvider adapter is
  built against it (BRD Section 15: "verify every exact write operation
  required by TargetGum before depending on it for production automation").
- The `MetricoolProvider` adapter (Week 2) will wrap exactly the operations
  confirmed available, and document any gap in this file per BRD Section 125.

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
