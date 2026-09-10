# reports

Report generation (BRD-PRD Section 41, 68).

- `generate.ts` — `generateReport` builds a `ReportContent` directly from an
  agent's already-validated `AnalysisResult` (`src/lib/agents/
  analytics-agent.ts`) — never a fresh AI call re-describing numbers, the
  "Claude guesses metrics" anti-pattern Section 68 warns against. `CLIENT`
  reports omit `evidence`, `confidence`, and `dataGaps` (no internal AI
  reasoning exposed — Section 41/102); `INTERNAL` reports include
  everything. Gated by `clients.read`, tenant-scoped via
  `getAuthorizedClient`. `listReports` filters by client and type.

Consumed by `src/lib/workflows/analyze-client-workflow.ts` (Day 11), which
always generates an `INTERNAL` report at the end of a run; a `CLIENT`
report is a separate, explicit call — not produced automatically — until a
client-portal report view exists (Day 13+).

Tested in `tests/integration/reports.test.ts`.
