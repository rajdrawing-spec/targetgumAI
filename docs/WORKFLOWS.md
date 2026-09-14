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
  → Metricool/Meta/Google/Amazon Ads data → GA4 data → GSC data
  → Data normalization → Claude analysis → Findings → Recommendations
  → Priority → Tasks → Approval if execution is requested
  → Proposed actions dispatched per automation level/policy → Report → Audit
```

Each arrow above a `WorkflowStep` boundary is recorded (`analysis` →
`persist_recommendations` → `route_recommendations` →
`execute_proposed_actions` → `report`), each as `RUNNING` then
`SUCCEEDED`/`FAILED`/`SKIPPED`, under one `WorkflowRun` that itself ends
`SUCCEEDED` or `FAILED`. Four paths are tested
(`tests/integration/analyze-client-workflow.test.ts`,
`tests/integration/dispatch-proposed-actions.test.ts`):

- **Success**: recommendations persisted, HIGH/CRITICAL ones routed to a
  real `PENDING` `Approval`, everything else to a `Task`, an `INTERNAL`
  report generated, a `SUCCESS` audit event recorded.
- **All data sources unavailable** (Day 9's guard: `aiRunId: null`, no
  Claude call): `persist_recommendations`/`route_recommendations`/
  `execute_proposed_actions` are recorded `SKIPPED`, not run against
  nothing — the report step still runs and the workflow still completes
  `SUCCEEDED`.
- **Proposed actions** (Phase 3): when the agent's output includes
  `proposedActions`, `execute_proposed_actions` hands them to
  `dispatchProposedActions` (`src/lib/automation/dispatch-proposed-actions.ts`)
  - see docs/DECISIONS.md for its full automation-level/policy gating.
  `SKIPPED` (no proposals, or the client isn't opted in) unless the client
  actually is.
- **Failure** (e.g. the AI Gateway call fails): the run is marked `FAILED`
  with the error message, a `FAILURE` audit event is recorded, and the
  error propagates — no partial/silent success.

No campaign modification happens merely because Claude recommends or
proposes it (BRD Section 19) — the agent itself is still read-only by
construction (its own Tool Registry allowlist has zero write tools); this
workflow ends at recommendations + proposed actions + a report + any
pending approvals or (only where a client's own automation level and
policy explicitly allow it) real executions `dispatchProposedActions`
produced. A human approving a pending `Approval` (`executeApprovedTool`,
Day 10) is always the path for anything the client hasn't explicitly
opted into auto-running.

## Post-analytics workflows (built after the above is stable)

- **Creative workflow** (BRD Section 47) ✅ implemented (Phase 2, Day 17,
  `src/lib/workflows/creative-workflow.ts`) — Client Brain → Claude
  creative concepts → `CreativeAsset` rows (`DRAFT`), each independently
  carried through `IN_REVIEW`/`APPROVED`/`REJECTED`
  (`src/lib/creative/persist.ts`), with Canva design generation and brand
  alignment folded in as documented below. Deliberately the first agent
  workflow that does NOT persist `Recommendation`s or route to
  `Task`/`Approval`/`Report` - a `CreativeAsset` is a different kind of
  thing (BRD Section 67), not an analysis output. "Brand validation" is
  folded into the Creative Agent's own structured output
  (`brandAligned`/`brandNotes` per concept) rather than a separate gate.
  "→ Approval → Metricool scheduling" happens after this workflow ends: a
  human attaches an `APPROVED` `CreativeAsset` to a `ContentCalendarItem`
  via its existing `creativeAssetId` field (a new dropdown on the "Add to
  calendar" form), which then goes through the already-built Social
  scheduling workflow below - no automatic hand-off. See docs/DECISIONS.md.
- **Social scheduling** (BRD Section 48): Draft → Approved → Scheduled →
  Published → Failed → Cancelled, all persisted in `content_calendar`.

## Scheduled Automation (BRD-PRD Section 65) — Weekly implemented (Phase 2)

**Weekly** is implemented (BRD Section 85's Phase 2 backlog names exactly
this cadence - "Weekly automated intelligence"); Daily/Monthly remain
designs only, a deliberate, documented scope cut (see docs/DECISIONS.md),
not started. **Opt-in per client via `client_policies`
(`weeklyAutomationEnabled`), never enabled globally by default** - exactly
as this section always specified.

```text
Vercel Cron (weekly) → GET /api/cron/weekly-intelligence
  → finds opted-in, not-recently-run clients → enqueues a BullMQ job per
    client (Redis) → scripts/worker.ts (a separate always-on process)
    processes each job → runAnalyzeClientWorkflow, run as the client's own
    assigned account_manager/marketing_employee (never a fabricated
    "system" actor - src/lib/queue/resolve-actor.ts)
```

This is not a new workflow - `processWeeklyIntelligenceJob`
(`src/lib/queue/weekly-intelligence-worker.ts`) calls the exact same
`runAnalyzeClientWorkflow` a human triggers by clicking "Analyze this
client" above. Every `AiRun`/`WorkflowRun`/`Recommendation`/`Report`/audit
row it produces is indistinguishable in shape from a manual trigger -
deliberately, so nothing downstream needs to special-case "was this
automated." See docs/ARCHITECTURE.md §4a for the full deployment topology
and why it needs two processes (Vercel can't host BullMQ's polling
worker), and docs/DECISIONS.md for the resolveAutomationActor design.

## Idempotency (BRD-PRD Section 57)

Every external write step carries `{ idempotency_key, workflow_run_id,
step_id, provider, provider_action }`. Before executing, the engine checks
"has this exact action already succeeded?" — if yes, it does not repeat it.
Weekly automation (above) is the first concrete example of both halves of
this rule at once: `enqueueWeeklyIntelligenceJob`'s BullMQ `jobId`
(`<clientId>-<ISO week>`) makes a duplicate cron tick a harmless no-op
before a job even runs, and `findClientsDueForWeeklyIntelligence`'s
"no `SUCCEEDED` run in the last 7 days" check is exactly "has this exact
action already succeeded" applied at the workflow level.

## Verification Rule

Execution steps are followed by a verification step that re-reads the
provider's state to confirm the write took effect as expected, before the
workflow is marked complete. A mismatch is recorded as a failure, not
silently ignored.
