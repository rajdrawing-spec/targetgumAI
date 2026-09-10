# Workflows — TargetGum AI Marketing OS

Status: **Design draft.** The workflow engine is not implemented yet (end of Week 1 /
into Week 2, per `docs/MVP-CHECKLIST.md`).

## Core Workflow Shape (BRD-PRD Section 23)

```text
Trigger → Condition → AI Agent → Tool → Validation → Approval → Execution
  → Verification → Notification
```

The engine must support: scheduling, delays, conditions, retries, timeouts,
idempotency, failure states, manual intervention, approval pauses, resume,
and audit logging on every transition.

## MVP Workflow — "Analyze Client A's marketing performance" (BRD-PRD Section 46)

This is the one complete workflow the MVP proves end-to-end:

```text
User request → Client resolution → Authorization → Client Brain
  → Metricool data → GA4 data → GSC data → Data normalization
  → Claude analysis → Anomaly detection → Findings → Recommendations
  → Priority → Tasks → Approval if execution is requested → Report → Audit
```

No campaign modification happens merely because Claude recommends it (BRD
Section 19) — analysis workflows are read-only by construction; only an
explicit, approved execution step can write to a provider.

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
