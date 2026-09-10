# tools

The Tool Registry (BRD-PRD Section 13) — agents call TargetGum tools, never vendor
SDKs directly (Section 109).

- `types.ts` — `ToolDefinition<Input, Output>`: metadata + Zod schemas + `execute`.
- `registry.ts` — `registerTool()` upserts metadata into the `Tool` table and keeps
  the executable implementation in an in-memory map. Real tools (Metricool, GA4, GSC)
  register themselves from their own `src/lib/integrations/*` module (Day 6+).
- `execute.ts` — `executeTool()`: the only way anything runs a tool. Walks the full
  authorization chain (permission → client access → agent allowlist → risk level)
  before executing, validates input/output against the tool's own schemas, handles
  idempotency, and audits every outcome — success, failure, or denial. A HIGH/CRITICAL
  tool call doesn't execute here at all — it creates a PENDING `Approval`
  (`src/lib/approvals/`) and throws `ApprovalRequiredError` carrying its id.
  `executeApprovedTool(ctx, approvalId)` is the other half: re-runs the full
  authorization chain (risk gate skipped — the approval IS that decision) once a
  human approves it, and marks the approval `EXECUTED`/`FAILED` on the way out.
- `errors.ts` — typed errors, including `ApprovalRequiredError` (HIGH/CRITICAL tool
  calls, see above) and `RiskLevelBlockedError` (a HIGH/CRITICAL call with no target
  client, or where the approval couldn't even be created — denied outright, since an
  `Approval` requires a client).

See `docs/APPROVALS.md` for the risk model and `docs/SECURITY.md` for the
authorization invariants this module enforces.
