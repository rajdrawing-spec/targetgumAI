# MVP Checklist — TargetGum AI Marketing OS

Tracks progress against the phased plan in `docs/BRD-PRD.md` Sections 81-84.
Update this file whenever a step completes or scope changes.

## Week 1 — Foundation

### Day 1 — Repository, architecture, docs ✅ DONE (this delivery)

- [x] Create repository / branch
- [x] Create application skeleton (Next.js + TS + Tailwind, no business logic)
- [x] Establish architecture (`docs/ARCHITECTURE.md`)
- [x] Create `CLAUDE.md`
- [x] Create documentation set (`docs/*.md`)
- [x] Set up development environment (package.json, tsconfig, eslint, prettier,
      vitest, playwright config, CI workflow, `.env.example`)
- [x] **Architecture plan reviewed by user** — hosting, Metricool scope, and
      pilot-credential approach confirmed 2026-09-10 (see `docs/DECISIONS.md`)

### Day 2 — Database, organizations, users, clients, roles ✅ DONE

- [x] Full Prisma schema per `docs/DATA-MODEL.md` (43 tables)
- [x] Initial migration (`20260910092421_init`), applied + verified against
      a local Postgres instance
- [x] Seed script (dev-only sample org/roles/permissions/client), verified
      idempotent

### Day 3 — Authentication, authorization, tenant isolation, security tests ✅ DONE

- [x] Auth.js v5 setup: Credentials provider (email/password + optional TOTP
      step) and Nodemailer provider (magic link, console fallback when SMTP
      isn't configured), JWT session strategy (required alongside
      Credentials), Prisma adapter wired for the magic-link verification flow
- [x] TOTP MFA enrollment/verification (`src/lib/auth/mfa.ts`, `otpauth`),
      secrets envelope-encrypted (`src/lib/crypto/envelope.ts`, AES-256-GCM)
      before ever touching the database. Recovery-code generation exists but
      isn't persisted/wired into a UI yet — tracked as a gap below.
- [x] RBAC resolution (`src/lib/rbac/context.ts`): org role + permission set
      + client access (ALL for super_admin, explicit ClientAssignment set for
      Account Manager/Marketing Employee, ClientUser set for the client
      portal role)
- [x] Tenant-scoped query helpers in `src/lib/db/tenant.ts`
      (`getAuthorizedClient`, `scopedClientWhere`)
- [x] Security tests: cross-client access, deleted/disabled-user access,
      privilege escalation — all passing against a real Postgres instance
      (34 tests total across unit/integration/security)
- [x] Minimal `/sign-in` and `/dashboard` pages to exercise the flow
      end-to-end; page-level `redirect()` guards protect `/dashboard` (no
      Next.js middleware yet — see `docs/DECISIONS.md` for why)
- [x] **Manually verified live** (not just automated tests): unauthenticated
      `/dashboard` redirects to `/sign-in`; a wrong password redirects with
      `error=CredentialsSignin&code=invalid_credentials`; a super_admin login
      sees both seeded clients; a marketing_employee login sees only the one
      client they're assigned to — real proof tenant isolation holds, not
      just in test doubles

**Known gaps to close before this is production-ready** (not blocking Day 4):
recovery-code persistence/UI, rate limiting on the credentials endpoint,
CSRF-protected server actions for anything beyond Auth.js's own routes, and
a real sign-up/user-invitation flow (dev users are seed-script-only so far).

### Day 4 — Claude integration, AI Gateway, structured outputs, AI run tracking ✅ DONE

- [x] `src/lib/ai/client.ts` — lazy Anthropic client singleton (constructed
      on first use, not at import time - same fix as the Day 3 Nodemailer
      gotcha, since ANTHROPIC_API_KEY legitimately isn't set during
      build/typecheck/tests)
- [x] `src/lib/ai/models.ts` — named model tiers (`fast`/`default`/
      `reasoning`) resolved to concrete model IDs in one place, plus
      per-tier USD pricing for cost estimation (BRD Section 73's cost-tiering
      requirement — deliberately not hardcoded to one model everywhere)
- [x] Prompt versioning (`prompts/<category>/vN.md` + `src/lib/ai/prompts.ts`):
      loads the latest (or an explicit) version, interpolates `{{variables}}`,
      and refuses to interpolate any variable whose *name* looks like a
      secret (docs/SECURITY.md)
- [x] Structured output validation via Claude's native `output_config.format`
      + `zodOutputFormat()` (not manual JSON parsing or tool-choice forcing)
      — schemas for this must be built with `zod/v4` specifically (see
      docs/DECISIONS.md for why the app has two zod import paths)
- [x] `ai_runs` persistence (`src/lib/ai/gateway.ts`): every call creates a
      RUNNING row up front and finalizes it SUCCEEDED/FAILED with token
      counts, estimated cost, and duration — never fabricated data (BRD
      Section 56)
- [x] Retry policy: transient API errors (rate limit, connection, 5xx) retry
      with backoff; non-retryable errors (bad request, auth, etc.) fail
      immediately; a schema-validation failure gets one extra attempt
- [x] Real starter prompts for all three categories (`analytics`, `content`,
      `reporting`), not placeholders — each encodes the relevant BRD rules
      (evidence-based findings, brand-voice constraints, no invented metrics)
      even though no agent consumes them yet (that's Day 9)
- [x] 15 new tests (unit: models, prompts, client-guard; integration:
      full gateway orchestration — success, retry-then-succeed,
      non-retryable-fails-fast, invalid-output-retry, exhausted-retries —
      against a real Postgres `ai_runs` table with an injected fake
      Anthropic client)

**Not done yet, deliberately** (Day 5+): tool permission checking (no Tool
Registry exists until Day 5 — this gateway runs single structured-output
calls, no tool use), Context Router / Client Brain retrieval (Day 8, once
Client Brain has real CRUD and data), and any actual agent wiring these
prompts into a real workflow (Day 9 Analytics Agent).

**Known gap:** no live call against the real Anthropic API has been made —
this sandbox has no `ANTHROPIC_API_KEY` configured. Confidence today comes
from the SDK's compile-time-checked types plus the mocked-client integration
suite above; a real end-to-end smoke test (like the Day 3 auth one) is
pending the user providing a key, tracked in `docs/EXTERNAL-APPROVALS.md`.

### Day 5 — Tool registry, permission system, audit events ✅ DONE

- [x] Tool Registry implementation (`src/lib/tools/registry.ts`):
      `registerTool()` upserts declarative metadata into the `Tool` table and
      keeps the executable implementation (Zod schemas + `execute`) in an
      in-memory map — Postgres can't store either
- [x] `executeTool()` (`src/lib/tools/execute.ts`) — the single entry point,
      walking the full BRD Section 31 authorization chain before anything
      runs: required permissions → client access (tenant isolation extends
      to tool calls) → agent allowlist → risk level → input schema, only
      then executing, then output schema → `ToolExecution` row →
      `audit_events`
- [x] Per-agent tool allowlist enforcement: `registerAgent()`
      (`src/lib/agents/registry.ts`) syncs `Agent` + `AgentTool` rows; an
      agent calling a tool outside its allowlist is denied and audited
- [x] Append-only `audit_events` writer (`src/lib/audit/record.ts`):
      `recordAuditEvent` is the only write path (no update/delete exposed);
      `listAuditEvents` is the tenant-scoped, `audit.read`-gated reader
- [x] **HIGH/CRITICAL-risk tools are hard-blocked**, not silently allowed —
      there's no Approval Engine yet (Day 10), so per BRD Section 21's
      "approval required"/"approval always required," the only safe default
      until then is deny, not execute-unchecked. `RiskLevelBlockedError`
      makes this explicit rather than a silent no-op.
- [x] Idempotency (BRD Section 57): a repeated call with the same
      `idempotencyKey` returns the prior `SUCCEEDED` result instead of
      re-executing — verified with a test that would fail if it re-ran
- [x] Every outcome is audited — success, failure, AND denial (not just
      successes) — verified for each authorization-chain failure mode
- [x] 15 new tests: tool registration/upsert mechanics, end-to-end
      execution with real audit trail, idempotency short-circuit, output-
      schema-validation failure (integration); permission denial, cross-
      client denial, agent-allowlist denial, risk-level block, unknown-tool
      denial — all audited (security, mapping directly to BRD Section 80
      scenario 2 "agent tries to call an unauthorized tool"); audit-read
      RBAC (integration)

No real tools are registered yet — Day 5 delivers the mechanism only, tested
against throwaway `test.*` tools defined in the test files themselves. The
first real tools (Metricool) land in Day 6.

## Week 2 — Intelligence

### Day 6 — Metricool

- [ ] Verify exact Metricool MCP operations required by MVP (see
      `docs/INTEGRATIONS.md` — ads endpoints not yet confirmed available)
- [ ] Connection model + client-to-brand mapping
- [ ] `MetricoolProvider` (Social) + `MetricoolMockProvider`
- [ ] Integration health tracking

### Day 7 — GA4 + Search Console

- [ ] GA4 `AnalyticsProvider` + OAuth
- [ ] GSC `SEOProvider` + OAuth

### Day 8 — Client Brain

- [ ] Client Brain schema implementation + CRUD
- [ ] Context Router (relevant-slice selection, not whole-brain injection)

### Day 9 — Analytics Agent

- [ ] Marketing Analytics Agent (contract, tools, prompts)

### Day 10 — Recommendation engine, tasks, approvals

- [ ] Structured recommendation schema + persistence
- [ ] Task creation from recommendations
- [ ] Approval engine implementation

## Week 3 — End-to-End MVP

### Day 11 — "Analyze Client A" complete workflow

### Day 12 — Security / adversarial testing (BRD Section 80, all 10 scenarios)

### Day 13 — Dashboard (recommendations, tasks, approvals, AI runs)

### Day 14 — Reports, audit trail, integration health, error states

### Day 15 — Real client pilot

## MVP Exit Criteria (BRD-PRD Section 84)

- [ ] Real client can be created
- [ ] Client data is isolated
- [ ] Metricool works for required operations
- [ ] GA4 works
- [ ] GSC works
- [ ] Claude analysis works
- [ ] Findings are evidence-based
- [ ] Recommendations are structured
- [ ] Tasks can be created
- [ ] Approval works
- [ ] Audit trail works
- [ ] Reports work
- [ ] Integration failures are handled
- [ ] Cross-client security tests pass
