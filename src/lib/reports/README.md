# reports

Report generation (BRD-PRD Section 41, 68).

- `generate.ts` — `generateReport` builds a `ReportContent` directly from an
  agent's already-validated `AnalysisResult` (`src/lib/agents/
  analytics-agent.ts`) — never a fresh AI call re-describing numbers, the
  "Claude guesses metrics" anti-pattern Section 68 warns against. `CLIENT`
  reports omit `evidence`, `confidence`, and `dataGaps` (no internal AI
  reasoning exposed — Section 41/102); `INTERNAL` reports include
  everything. Gated by `clients.read`, tenant-scoped via
  `getAuthorizedClient`. `listReports`/`getReport` read a single client's
  reports; `listReportsForOrg` (Day 14) is the cross-client, dashboard-facing
  read, scoped like every other org-wide helper (`scopedClientWhere`).
  `generateClientReportFromInternal` (Day 14) derives a `CLIENT` report from
  an already-generated `INTERNAL` one by redacting its *persisted* content —
  still never a fresh AI call, since no `AnalysisResult` is re-derived.

Consumed by `src/lib/workflows/analyze-client-workflow.ts` (Day 11), which
always generates an `INTERNAL` report at the end of a run, and by the Day
13/14 dashboard (`src/app/dashboard/reports/`) — a list page, a detail page
rendering full findings/recommendations/data-gaps, and a "Generate client
report" action wrapping `generateClientReportFromInternal`.

Tested in `tests/integration/reports.test.ts`.
