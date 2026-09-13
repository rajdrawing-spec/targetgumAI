# workflows

Minimal `WorkflowRun`/`WorkflowStep` tracking plus the one MVP workflow
built on it (BRD-PRD Section 23, 46). See `docs/WORKFLOWS.md` and
`docs/DECISIONS.md` (Day 11 entry) for why this is deliberately not the
full Workflow Engine (scheduling, delays, retries, pause/resume as a
generic state machine) Section 23 describes — that's larger, speculative
infrastructure with no second caller yet.

- `runs.ts` — `getOrCreateWorkflow` (idempotent by `organizationId_key`),
  `startWorkflowRun`, `recordWorkflowStep`, `completeWorkflowRun`. Just
  enough to give a workflow invocation a durable, queryable run record
  with per-stage status transitions (`RUNNING` → `SUCCEEDED`/`FAILED`/
  `SKIPPED`).
- `analyze-client-workflow.ts` — `runAnalyzeClientWorkflow`
  (`ANALYZE_CLIENT_WORKFLOW_KEY`): the "Analyze Client A" workflow (BRD
  Section 46). Gated by `analysis.trigger` (Phase 2 - staff-only:
  `employee`/`super_admin`, not `client` -
  a client can review what an analysis produces but not spend on running a
  fresh one themselves; see docs/DECISIONS.md). Wires client resolution/
  authorization → the Marketing Analytics Agent (`src/lib/agents/
  analytics-agent.ts`, Day 9) → `persistRecommendations` + `routeRecommendation`
  (`src/lib/recommendations/`, Day 10) → `generateReport` (`src/lib/reports/`,
  Day 11) → `recordAuditEvent`, tracking each stage as a `WorkflowStep`. Never
  executes anything itself (BRD Section 19) — it ends at recommendations +
  a report + any pending approvals it created.

Tested end-to-end in `tests/integration/analyze-client-workflow.test.ts`
and `tests/integration/client-portal-permissions.test.ts` (the
`analysis.trigger` gate specifically) against a real database, with
Anthropic/Metricool/GA4/GSC exercised through injected fakes or mock
providers.
