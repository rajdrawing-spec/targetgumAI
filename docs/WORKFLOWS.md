# Workflows — TargetGum AI Marketing OS

Status: **Day 11 done.** The one MVP workflow below (`runAnalyzeClientWorkflow`,
`src/lib/workflows/analyze-client-workflow.ts`) is implemented, tracked, and
tested end-to-end against a real database. It runs on top of a minimal
`WorkflowRun`/`WorkflowStep` tracker (`src/lib/workflows/runs.ts`) — **not**
the general Workflow Engine described in Section 23 below (scheduling,
delays, conditions, retries, timeouts, pause/resume as a generic state
machine). That's deliberately deferred: it's larger, speculative
infrastructure with no second caller yet. See `docs/DECISIONS.md` for the
rationale; generalize once a second real workflow needs the same shape.

## Core Workflow Shape (BRD-PRD Section 23) — target shape for the general engine

```text
Trigger → Condition → AI Agent → Tool → Validation → Approval → Execution
  → Verification → Notification
```

The engine must support: scheduling, delays, conditions, retries, timeouts,
idempotency, failure states, manual intervention, approval pauses, resume,
and audit logging on every transition. Not yet built — see status above.

## MVP Workflow — "Analyze Client A's marketing performance" (BRD-PRD Section 46) ✅ implemented

This is the one complete workflow the MVP proves end-to-end
(`runAnalyzeClientWorkflow`):

```text
User request → Client resolution → Authorization → Client Brain
  → Metricool data → GA4 data → GSC data → Data normalization
  → Claude analysis → Anomaly detection → Findings → Recommendations
  → Priority → Tasks → Approval if execution is requested → Report → Audit
```

Each arrow above a `WorkflowStep` boundary is recorded (`analysis` →
`persist_recommendations` → `route_recommendations` → `report`), each as
`RUNNING` then `SUCCEEDED`/`FAILED`/`SKIPPED`, under one `WorkflowRun` that
itself ends `SUCCEEDED` or `FAILED`. Three paths are tested
(`tests/integration/analyze-client-workflow.test.ts`):

- **Success**: recommendations persisted, HIGH/CRITICAL ones routed to a
  real `PENDING` `Approval`, everything else to a `Task`, an `INTERNAL`
  report generated, a `SUCCESS` audit event recorded.
- **All data sources unavailable** (Day 9's guard: `aiRunId: null`, no
  Claude call): `persist_recommendations`/`route_recommendations` are
  recorded `SKIPPED`, not run against nothing — the report step still runs
  and the workflow still completes `SUCCEEDED`.
- **Failure** (e.g. the AI Gateway call fails): the run is marked `FAILED`
  with the error message, a `FAILURE` audit event is recorded, and the
  error propagates — no partial/silent success.

No campaign modification happens merely because Claude recommends it (BRD
Section 19) — this workflow is read-only by construction; it ends at
recommendations + a report + any pending approvals it created. Only a
separate, explicit `executeApprovedTool` call (Day 10) — after a human
approves — can write to a provider.

## Post-analytics workflows (built after the above is stable)

- **Creative workflow** (BRD Section 47): Recommendation → Client Brain →
  Content strategy → Claude creative concepts → Canva MCP → Brand validation
  → Approval → Metricool scheduling.
- **Social scheduling** (BRD Section 48): Draft → Approved → Scheduled →
  Published → Failed → Cancelled, all persisted in `content_calendar`.

## Scheduled Automation (BRD-PRD Section 65)

Daily/weekly/monthly scheduled workflows exist as designs but are **opt-in
per client via `client_policies`**, never enabled globally by default.

## Idempotency (BRD-PRD Section 57)

Every external write step carries `{ idempotency_key, workflow_run_id,
step_id, provider, provider_action }`. Before executing, the engine checks
"has this exact action already succeeded?" — if yes, it does not repeat it.

## Verification Rule

Execution steps are followed by a verification step that re-reads the
provider's state to confirm the write took effect as expected, before the
workflow is marked complete. A mismatch is recorded as a failure, not
silently ignored.
