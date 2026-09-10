# audit

Append-only audit event writer (BRD-PRD Section 28).

- `record.ts` — `recordAuditEvent()` is the ONLY write path; there is no update/delete
  function here, and none should be added. `listAuditEvents(ctx, filter?)` is the
  tenant-scoped, permission-gated read path (`audit.read` — Super Admin only by
  default, BRD Section 4.1).

`src/lib/tools/execute.ts` calls `recordAuditEvent` for every tool-execution outcome
(success, failure, or denial) — that's the primary caller today. The AI Gateway
(`src/lib/ai/`) records its own runs in `ai_runs` rather than here, per BRD Section 27
(AI Run Tracking is a distinct concern from the audit trail); a future pass may want
an audit event per AI run too, not yet decided.

DB-level `REVOKE UPDATE, DELETE` on `audit_events` for the app's DB role is still
pending a hosting decision — see docs/SECURITY.md.
