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
  idempotency, and audits every outcome — success, failure, or denial.
- `errors.ts` — typed errors, including `RiskLevelBlockedError`: HIGH/CRITICAL tools
  are hard-blocked until the Approval Engine exists (Day 10) — never executed unchecked.

See `docs/APPROVALS.md` for the risk model and `docs/SECURITY.md` for the
authorization invariants this module enforces.
