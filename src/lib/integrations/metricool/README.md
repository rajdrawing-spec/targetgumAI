# integrations/metricool

The first operational social/ads integration (BRD Section 15).

- `providers.ts` (one level up, `src/lib/integrations/providers.ts`) — the vendor-
  neutral `SocialProvider`/`AdsProvider` interfaces this adapter implements.
- `mcp-client.ts` — low-level MCP client connecting to `METRICOOL_MCP_URL`. **Not
  live-verified** — no real connection details are configured anywhere this code has
  run (docs/EXTERNAL-APPROVALS.md). The tool names/schemas it calls ARE verified
  (checked live during Day 1 against a working Metricool MCP connection).
- `provider.ts` — `MetricoolProvider`: the real adapter. Implements `SocialProvider`
  fully and `AdsProvider` read-only (`getCampaigns`/`getCampaignPerformance`) — every
  ads write method throws `UnsupportedOperationError`, since Metricool's MCP has no
  ads write endpoints at all (not an account-plan limitation — see docs/INTEGRATIONS.md).
  **Safety invariant:** `schedulePost`/`createPost` always send `draft: true` to
  Metricool — nothing in this adapter can cause real-world publication (docs/DECISIONS.md).
  `parseMetricRows`/`numericField`/`stringField` (Day 15) parse
  `getAnalyticsDataByMetrics`'s real `{ rows: [[...values, "YYYYMMDD"]] }` response
  shape — found via this session's own live Metricool connection to differ from what
  was originally assumed from documentation; see docs/INTEGRATIONS.md and
  docs/DECISIONS.md for the full story, and
  `tests/unit/metricool-provider.test.ts` for the tests pinning it down.
- `connect.ts` (Day 15) — `connectClientToMetricoolBrand(ctx, clientId, brandId,
  label?)`: the missing onboarding step through Day 14 - gated by
  `integrations.manage`, verifies the brand id via a real `getConnectedNetworks` call
  (marks the connection `CONNECTED` only on success, `ERROR` with the real message
  otherwise) rather than trusting whatever the caller typed. The dashboard's client
  detail page (`src/app/dashboard/clients/[clientId]/page.tsx`) is its only caller.
- `mock-provider.ts` — `MetricoolMockProvider`: full in-memory implementation of both
  interfaces, including ads writes (as accepted no-ops), so workflows can be built and
  tested without credentials (BRD Section 92).
- `index.ts` — `getMetricoolProvider()`: returns the real adapter when
  `METRICOOL_MCP_URL` is set, else the mock (with a warning).
- `tools.ts` — `registerMetricoolTools()`: registers the Tool Registry entries from
  BRD Section 13's own example list (`get_posts`, `schedule_post`,
  `get_social_analytics`, `get_ad_campaigns`, `get_ad_performance`) —
  `update_ad_campaign` is deliberately not registered, since there's nothing for it to
  call. Every tool resolves its target brand via the caller's `IntegrationConnection`
  (`src/lib/integrations/health.ts`) — never accepts a brandId directly.
