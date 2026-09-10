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

### Day 6 — Metricool ✅ DONE

- [x] Verified exact Metricool MCP operations against a live connection
      (Day 1 + confirmed again in detail for the scheduling tools this day):
      `getBrandSettings`, `getAnalyticsAvailableMetrics`,
      `getAnalyticsDataByMetrics`, `getScheduledPosts`, `createScheduledPost`,
      `updateScheduledPost`, `createScheduledPostForReview`,
      `sendScheduledPostForReview`, `getBestTimeToPostByNetwork` — full
      schemas recorded in code comments (`src/lib/integrations/metricool/
      provider.ts`) so nothing downstream is guessed
- [x] Provider interfaces (`src/lib/integrations/providers.ts`):
      `SocialProvider`, `AdsProvider` — vendor-neutral, per BRD Section 16
- [x] Connection model + client-to-brand mapping
      (`src/lib/integrations/health.ts`): generic Client → Integration →
      IntegrationAccount → IntegrationConnection (BRD Section 33), reusable
      by GA4/GSC (Day 7) and any future provider, not Metricool-specific
- [x] Integration health tracking (BRD Section 34): `CONNECTED` /
      `AUTH_REQUIRED` / `ERROR` / etc., `withIntegrationHealthTracking()`
      wraps every provider call and updates health on success/failure;
      denies (never fabricates data) when a client has no connection or an
      unhealthy one
- [x] `MetricoolProvider` (real adapter, via a genuine MCP client -
      `@modelcontextprotocol/sdk` - connecting to `METRICOOL_MCP_URL`, not
      an assumed REST API - see docs/DECISIONS.md) + `MetricoolMockProvider`
      (full in-memory implementation of both interfaces)
- [x] **Safety invariant, tested**: `schedulePost`/`createPost` always send
      `draft: true` to Metricool regardless of caller input - nothing this
      adapter does can cause real-world publication. `publishPost` and every
      `AdsProvider` write method throw `UnsupportedOperationError` (no
      verified Metricool tool exists for them)
- [x] Tool Registry entries (`src/lib/integrations/metricool/tools.ts`) -
      BRD Section 13's own example list: `get_posts`, `schedule_post`,
      `get_social_analytics`, `get_ad_campaigns`, `get_ad_performance`.
      `update_ad_campaign` deliberately NOT registered (no working
      implementation exists for it - "do not assume unsupported operations")
- [x] 23 new tests (92 total): mock provider full-interface coverage; real
      adapter mapping logic against an injected fake MCP client (brand
      filtering, error propagation, the `draft: true` safety invariant, every
      write method throwing `UnsupportedOperationError`); connection
      model/health tracking against a real DB (denies before first
      connection, records success/failure, preserves last-successful-sync
      through a later failure); full end-to-end tool execution through the
      exact `executeTool()` path an agent would use, including a client with
      no connection at all getting `IntegrationUnavailableError` rather than
      fabricated data

**Known gap**: no live call has been made against a real Metricool MCP
server — no `METRICOOL_MCP_URL`/`METRICOOL_API_KEY` configured in this
environment. The adapter's request-building logic is verified; the wire
connection is not. Tracked in `docs/EXTERNAL-APPROVALS.md`.

### Day 7 — GA4 + Search Console ✅ DONE

- [x] `AnalyticsProvider`/`SEOProvider` interfaces added to
      `src/lib/integrations/providers.ts` (BRD Section 35/36 fields —
      dimensions/metrics with provenance for GA4, query/clicks/impressions/
      CTR/position for GSC)
- [x] Shared Google OAuth2 helper (`src/lib/integrations/google/oauth.ts`,
      via the official `googleapis`/`google-auth-library` packages, not
      guessed): auth-URL construction, code-for-token exchange, and
      building an authenticated client from a stored refresh token (access-
      token refresh is automatic, handled by the library)
- [x] GA4 (`src/lib/integrations/ga4/`) and GSC (`src/lib/integrations/gsc/`)
      real adapters, wrapping the GA4 Data API `runReport` and Search
      Console `searchanalytics.query` respectively — both official,
      documented Google APIs (verified against the installed `googleapis`
      package's own type definitions, not training-data recall)
- [x] Full mock providers for both (`GA4MockProvider`, `GSCMockProvider`)
- [x] **Per-connection provider resolution** — a deliberate departure from
      Metricool's pattern: GA4/GSC credentials are per-client OAuth (a
      stored refresh token per `IntegrationConnection`), not one org-wide
      API key, so `resolveGA4Provider`/`resolveGSCProvider` take the
      resolved connection, not just an env-var check. This required
      widening `withIntegrationHealthTracking`'s callback to receive the
      full connection (Metricool's tools updated to match, still passing
      after the change - see docs/DECISIONS.md)
- [x] Credential storage: `saveProviderCredentials`/`loadProviderCredentials`
      added to `src/lib/integrations/health.ts`, reusing Day 3's envelope
      encryption (`src/lib/crypto/envelope.ts`) — refresh tokens are never
      stored in plaintext
- [x] Tool Registry entries: `ga4.get_report`, `gsc.get_search_performance`
      (BRD Section 13's own example list)
- [x] 11 new tests (103 total): mock provider coverage; OAuth URL
      construction and the configured/not-configured branches (token
      exchange itself isn't independently re-tested — see the gap noted
      below); full end-to-end tool execution through `executeTool()` for
      both providers, including unconnected clients getting
      `IntegrationUnavailableError`

**Known gaps** (documented, not silently skipped):
- No live call has been made against a real Google Cloud OAuth app / GA4
  property / Search Console property — no OAuth credentials configured in
  this environment. Tracked in `docs/EXTERNAL-APPROVALS.md`.
- Unlike Metricool (whose MCP client has a clean injection seam), the real
  GA4/GSC adapters' HTTP-level request/response mapping isn't independently
  unit-tested against a faked transport — `googleapis`' generated clients
  don't offer an easy way to inject a fake without an HTTP-mocking library,
  which wasn't added this round. The mapping code does compile against the
  real, official response types (`Schema$RunReportResponse`,
  `Schema$SearchAnalyticsQueryResponse`), which is partial but real
  assurance.
- No OAuth consent-flow UI/route exists yet (connecting a client's Google
  account is currently a library-only mechanism, no "Connect Google"
  button) — that lands with the dashboard (Day 13).

### Day 8 — Client Brain ✅ DONE

- [x] Client Brain CRUD (`src/lib/clients/brain.ts`): narrative sections
      (business/audience/brand/marketing) validated against Zod schemas on
      every write (`src/lib/clients/brain-schemas.ts`) — invalid data is
      rejected, not silently stored; plus brand assets, competitors,
      policy, and feedback CRUD, all tenant- and permission-checked exactly
      like every other module (no special case for Client Brain)
- [x] Context Router (`src/lib/clients/context-router.ts`):
      `assembleClientContext(ctx, clientId, category)` returns only the
      Client Brain slice relevant to `'analytics' | 'content' |
      'reporting'` — e.g. `'analytics'` gets business+marketing+competitors
      but not audience/brand; `'content'` gets business+audience+brand but
      not marketing/competitors — proving the "only relevant context, never
      the whole brain" requirement (BRD Section 7) rather than just
      asserting it
- [x] `renderContextAsText` turns the assembled context into a plain-text
      block for the AI Gateway's `userMessage` (Day 4) — this is the piece
      that connects Client Brain data to an actual Claude call, ready for
      Day 9's Analytics Agent to use
- [x] 19 new tests (122 total): section-schema validation (valid/invalid
      cases per section); full CRUD against a real DB including permission
      denial (marketing_employee lacking `clients.manage`) and cross-client
      denial; Context Router category-based section selection, competitors
      included only for `'analytics'`, feedback included for every
      category, cross-client denial, and text rendering excluding
      out-of-category sections

No agent consumes this yet — Day 9's Analytics Agent is the first real caller of
`assembleClientContext`.

### Day 9 — Analytics Agent ✅ DONE

- [x] Marketing Analytics Agent (`src/lib/agents/analytics-agent.ts`) —
      contract registered via `registerAgent()` (Day 5) with an allowlist
      of exactly its five LOW-risk read tools (Metricool social analytics/
      ad campaigns/ad performance, GA4, GSC) — verified by test, including
      that every one of them is LOW risk (this agent cannot execute
      anything, only analyze - BRD Section 19)
- [x] `runMarketingAnalysis()` — the first real pipeline tying together
      every prior day: Context Router (Day 8) → Tool Registry execution
      against real `IntegrationConnection`s (Days 5-7) → AI Gateway
      structured output (Day 4) against `prompts/analytics/v1.md` (Day 4)
- [x] Structured output schema matches BRD Section 39/71 (priority, area,
      finding, evidence, likelyCause, recommendation, expectedImpact,
      confidence, requiresApproval) — built with `zod/v4` per the Day 4 gotcha
- [x] **Partial-failure tolerance**: one integration failing doesn't abort
      the run — it's recorded as a data gap and the analysis proceeds on
      what's available (verified: Metricool connected, GA4/GSC not →
      still analyzes, gaps reported)
- [x] **All-failure guard**: if every data source is unavailable, the agent
      returns early (`aiRunId: null`, empty recommendations) without
      calling Claude at all — verified the mocked Claude client is never
      invoked in this case, so cost isn't spent analyzing nothing (BRD
      Section 73 cost control) and nothing is fabricated (Section 56)
- [x] 4 new tests (126 total): agent registration/allowlist correctness;
      full pipeline end-to-end with a real DB + injected fake Anthropic
      client, asserting the actual prompt sent to Claude contains the
      gathered data and Client Brain context (not just that *a* call
      happened); partial-gap tolerance; the all-failure guard

Nothing produced here is persisted — Day 10 wires `AnalysisResult` into the
`recommendations` table, task creation, and the approval flow.

### Day 10 — Recommendation engine, tasks, approvals ✅ DONE

- [x] Recommendation persistence + lifecycle
      (`src/lib/recommendations/persist.ts`): `persistRecommendations` from
      an agent's `AnalysisResult`, `listRecommendations`,
      `acceptRecommendation`, `rejectRecommendation` — which also writes a
      `ClientFeedback` row (BRD Section 108's learning loop back to Day 8's
      Client Brain, verified by test)
- [x] Task creation (`src/lib/recommendations/tasks.ts`):
      `createTaskFromRecommendation` maps recommendation priority → task
      priority (CRITICAL→URGENT) and builds the description from evidence/
      likely cause. Gated by a new `tasks.create` permission (not
      `clients.manage`) so Account Manager and Marketing Employee can both
      create tasks per BRD Section 4.2-4.3, while Client User cannot
      (verified by test) — see docs/DECISIONS.md for why a new permission
      was needed rather than reusing an existing one
- [x] **Approval Engine** (`src/lib/approvals/approvals.ts`):
      create/list/get/approve/reject/cancel, `approvals.approve` (Account
      Manager+) vs `approvals.request` (Account Manager + Marketing
      Employee) gating verified by test, tenant-scoped throughout
- [x] **Replaces the Day 5 hard block for real**: `executeTool()`'s HIGH/
      CRITICAL risk gate now creates a `PENDING` approval and throws
      `ApprovalRequiredError` (carrying its id) instead of always denying;
      a new `executeApprovedTool(ctx, approvalId)` re-runs the full
      authorization chain (risk gate skipped - the approval is that
      decision) once approved, and marks the approval `EXECUTED`/`FAILED`
      based on the outcome — verified end-to-end including the failure path
- [x] `routeRecommendation` (`src/lib/recommendations/route.ts`) implements
      BRD Section 24's daily-workflow decision: HIGH/CRITICAL priority or
      `requiresApproval` → an Approval request; everything else → a task
- [x] 15 new tests (142 total): full approval lifecycle including
      cross-role denial (Marketing Employee can't approve/reject),
      cross-client denial, expiry-aware status checks, the
      execute-after-approval path actually running the tool (and marking
      FAILED when the underlying tool throws); recommendation persistence/
      accept/reject with the feedback-loop write; task creation permission
      and content; routing to task vs. approval

No approval-screen UI exists yet (Day 13, dashboard) — the engine itself is
complete and tested. Bidirectional Recommendation↔Approval status sync is a
known simplification, documented in `docs/APPROVALS.md`.

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
