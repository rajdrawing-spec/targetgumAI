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

### Day 11 — "Analyze Client A" complete workflow ✅ DONE

- [x] Minimal `WorkflowRun`/`WorkflowStep` tracking (`src/lib/workflows/runs.ts`):
      `getOrCreateWorkflow` (idempotent by `organizationId_key`),
      `startWorkflowRun`, `recordWorkflowStep`, `completeWorkflowRun` — a
      durable, queryable run record per invocation, not the general
      Workflow Engine (scheduling/delays/retries/pause-resume) BRD Section
      23 describes. That's larger, speculative infrastructure with no
      second caller yet; documented in `docs/DECISIONS.md` as scoped down
      on purpose, to be generalized once a second real workflow needs the
      same shape.
- [x] Report generation (`src/lib/reports/generate.ts`): `generateReport`
      builds a `ReportContent` directly from an agent's already-validated
      `AnalysisResult` — never a fresh AI call re-describing numbers (BRD
      Section 68's warning). `CLIENT` reports omit `evidence`,
      `confidence`, and `dataGaps` (no internal AI reasoning exposed — BRD
      Section 41/102); `INTERNAL` reports include everything. Gated by the
      existing `clients.read` permission, tenant-scoped via
      `getAuthorizedClient`. `listReports` filters by type.
- [x] **The complete workflow** (`src/lib/workflows/analyze-client-workflow.ts`,
      `runAnalyzeClientWorkflow`) wires every prior day into one callable,
      tracked, audited pipeline (BRD Section 46): client resolution +
      authorization → Day 9's Analytics Agent (Client Brain + Context
      Router + real-time Metricool/GA4/GSC data + Claude analysis) →
      Day 10's `persistRecommendations` + `routeRecommendation` (task vs.
      approval) → Day 11's `generateReport` (`INTERNAL`) → a
      `recordAuditEvent`. Each stage is recorded as a `WorkflowStep`
      (`RUNNING` → `SUCCEEDED`/`FAILED`/`SKIPPED`); the whole run completes
      as a `WorkflowRun` with `SUCCEEDED`/`FAILED` and, on failure, the
      error message. BRD Section 19 ("no campaign modification should
      occur merely because Claude recommends it") still holds — the
      workflow's job ends at recommendations + a report + any pending
      approvals it created, never at executing anything.
- [x] **All-data-gaps path handled explicitly**: when
      `analysis.aiRunId` is `null` (every integration unavailable, the Day
      9 guard), `persist_recommendations`/`route_recommendations` are
      recorded `SKIPPED` rather than run against nothing — the report step
      still runs (a report with no findings is still a truthful report)
      and the workflow still completes `SUCCEEDED`.
- [x] **Failure path**: if the analysis step throws (e.g. the AI Gateway
      call fails after exhausting Day 4's retries), the run is marked
      `FAILED` with the error message, a `FAILURE` audit event is
      recorded, and the error propagates to the caller — no partial/silent
      success.
- [x] 6 new tests (148 total): 3 in `tests/integration/reports.test.ts`
      (CLIENT vs. INTERNAL content filtering, tenant-scoped
      `listReports`); 3 in `tests/integration/analyze-client-workflow.test.ts`
      covering the full success path (one HIGH-priority recommendation
      routed to a real `PENDING` approval, one MEDIUM-priority
      recommendation routed to a real task, a report generated, every
      `WorkflowStep` and the audit event verified against the DB), the
      all-data-gaps path (steps `SKIPPED`, workflow still `SUCCEEDED`, the
      mocked Claude client never invoked), and the failure path (`FAILED`
      run + audit `FAILURE` event, no later steps recorded).

No trigger/UI exists yet to invoke this workflow on demand — it's a
directly-callable function today, exercised by the Day 3 dashboard shell's
future "Analyze" action or a scheduled job (Day 13+). The workflow itself is
complete and tested end to end against a real database with every external
provider (Anthropic, Metricool, Google) exercised through injected fakes or
mock providers.

### Day 12 — Security / adversarial testing (BRD Section 80, all 10 scenarios) ✅ DONE

- [x] Audited existing coverage against all ten BRD Section 80 scenarios
      before writing anything new. Four already had dedicated, explicitly-
      cited coverage: scenario 1 (`tests/security/tenant-isolation.test.ts`),
      scenario 2 (`tests/security/tool-authorization.test.ts` for agent
      allowlists + `tests/security/privilege-escalation.test.ts` for
      permission-level denial), scenario 7 (`tests/integration/
      tool-registry.test.ts`'s idempotencyKey test — a repeated call returns
      the cached result and only one `ToolExecution` row is ever created),
      and scenario 9 (`tests/security/deleted-user.test.ts`).
- [x] The remaining six had no dedicated adversarial test and are now
      covered in a new `tests/security/adversarial-brd-section-80.test.ts`
      (8 tests, one file mapping 1:1 to the BRD list so coverage stays
      traceable):
      - **3 (cross-client context leakage)**: populates Client A's brain/
        feedback/competitor data, asserts none of it appears in Client B's
        `assembleClientContext`/`renderContextAsText` output, and confirms
        Client A's own context *does* contain it (isolation, not an
        empty-everything bug).
      - **4 (prompt injection to exfiltrate credentials)**: stores a real
        encrypted OAuth credential and an attacker-authored
        `ClientFeedback` row asking the AI to reveal it; the injection text
        passes through as inert data, but the actual secret never appears
        in the assembled context — proven structurally, since
        `assembleClientContext` never reads `encryptedCredentials` at all,
        not by pattern-matching/stripping the payload.
      - **5 (unauthorized budget change)**: a role without
        `integrations.manage` is denied before ever reaching the risk gate
        (no approval created); a role *with* the permission still can't
        execute directly — it's still routed to Approval.
      - **6 (approval token replay)**: extends the existing PENDING/
        REJECTED-replay coverage with the more direct attack — replaying
        an already-`EXECUTED` approval id is rejected outright and
        verified (by `ToolExecution` count) to never run the tool twice.
      - **8 (cross-client OAuth credential)**: two clients connected to the
        same provider with distinct encrypted credentials; resolving
        Client B's connection/credentials never returns Client A's, and
        vice versa.
      - **10 (tool returns malicious content)**: a tool whose own output
        embeds a prompt-injection payload is executed successfully and the
        payload is stored verbatim as ordinary data (never acted on — the
        tool's *registered* risk level still governs gating); separately,
        an injected instruction inside a recommendation's free-text
        `finding` field cannot override its structured `priority` field
        for `routeRecommendation`'s routing decision.
- [x] 8 new tests (156 total). `docs/SECURITY.md`'s Section 80 checklist
      updated with a file pointer for every one of the ten scenarios.

All ten BRD Section 80 scenarios now fail safely with automated, repeatable
proof — not just code-review confidence.

### Day 13 — Dashboard (recommendations, tasks, approvals, AI runs) ✅ DONE

- [x] New org-wide (cross-client) read helpers, each scoped by the same
      `clientAccess` rule as every single-client read — `listAccessibleClients`
      (`src/lib/clients/list.ts`), `listRecommendationsForOrg`
      (`src/lib/recommendations/persist.ts`), `listTasksForOrg`
      (`src/lib/recommendations/tasks.ts`), `listAiRuns` (new
      `src/lib/ai/runs.ts`), `listIntegrationConnectionsForOrg`
      (`src/lib/integrations/health.ts`, deliberately never selects
      `encryptedCredentials` — a status view, not a credential-reading
      path). 6 new scoping tests in `tests/integration/
      dashboard-queries.test.ts` prove a role limited to Client A never
      sees Client B's rows through any of these, even though they're
      fetched "org-wide."
- [x] Dashboard shell (`src/app/dashboard/layout.tsx`): nav for the subset
      of BRD Section 42's full list that's actually implemented in the MVP
      — Overview, Clients, Recommendations, Tasks, Approvals, AI Runs
      (Social/Advertising/Analytics/SEO/Content Calendar/Creatives/
      Integrations/Audit/Settings are out of MVP scope per Section 45/49 -
      added alongside their modules).
- [x] **Overview** (`src/app/dashboard/page.tsx`, replacing the Day 3
      placeholder): active clients, pending approvals, high-priority
      recommendations, open tasks, integration health by status, recent AI
      runs — the BRD Section 42 home-dashboard subset with a backing
      module today. "Scheduled content"/"campaign alerts" omitted rather
      than shown empty/fake.
- [x] **Clients** list + **Client detail** page
      (`src/app/dashboard/clients/[clientId]/page.tsx`): policy summary,
      integration status, that client's recommendations/tasks/approvals/
      reports/AI runs, and an "Analyze this client" button — the MVP's
      button stand-in for BRD Section 43's natural-language trigger
      ("Analyze Client A's marketing performance"; Section 44's full
      command layer is Phase 2) — calling `runAnalyzeClientWorkflow`
      (Day 11) via a Server Action.
- [x] **Recommendations**, **Tasks**, **Approvals** pages: accept/reject,
      status updates, and approve/reject respectively, each as a Server
      Action (`src/app/dashboard/actions.ts`) that's a thin wrapper over
      the already permission/tenant-checked Day 10 library functions — no
      authorization logic added in the UI layer. Decision buttons are only
      rendered when `ctx.permissions` actually holds the deciding
      permission (`approvals.request`/`approvals.approve`/`tasks.create`),
      matching BRD Section 4.2-4.4's role split; the real enforcement is
      still server-side in the wrapped library calls.
- [x] **AI Runs** page: model, prompt version, tokens, cost, duration,
      status, per client.
- [x] End-to-end smoke-verified against a real Postgres instance with a
      headless browser (Playwright, already installed in this
      environment): seeded a real user/client/recommendation/task/
      approval/AI-run, signed in through the actual credentials form,
      walked every dashboard route (all 200, no error-boundary text, no
      console errors beyond an unrelated favicon 404), then exercised
      every Server Action from the rendered pages — including clicking
      "Analyze this client" through the real `runAnalyzeClientWorkflow`
      (the all-data-gaps path, since the smoke client had no integrations
      connected: completed `SUCCEEDED` with a real `INTERNAL` report, no
      AI spend) — and accept/start-task/approve, confirming no runtime
      errors anywhere in the new route tree. Fixture data and scratch
      scripts were removed afterward; the dev-seed organization (`npm run
      db:seed` / `prisma/seed.ts`) was restored.
- [x] **Found and fixed a real bug while smoke-testing**: `workflow_runs`'
      foreign key to `workflows` had no `onDelete` set (defaulting to
      `RESTRICT`), so deleting an `Organization` that had ever run the Day
      11 workflow failed — silently, because `tests/helpers/factory.ts`'s
      `cleanupOrg` swallows its own delete errors. Every
      `analyze-client-workflow.test.ts` run had been leaving its test
      Organization behind in the database. Fixed with a migration
      (`onDelete: Cascade` — a `WorkflowRun` has no meaning once its
      `Workflow` definition is gone) and cleaned up the accumulated
      orphaned test data; see `docs/DECISIONS.md`.
- [x] 6 new tests (162 total, up from 156).

No client-portal-specific view exists yet (a `client_user` today sees the
same dashboard, permission-filtered) — that's a Phase 2 refinement, not
required by BRD Section 45's MVP definition.

### Day 14 — Reports, audit trail, integration health, error states ✅ DONE

- [x] **Reports**: new `getReport` (single-report read with the same
      ownership check as every other `getOwned*` helper),
      `listReportsForOrg` (cross-client, `scopedClientWhere`-scoped, same
      pattern as Day 13's other org-wide helpers), and
      `generateClientReportFromInternal` — derives a `CLIENT`-type report
      from an already-generated `INTERNAL` one by redacting its
      *already-persisted* content (evidence/confidence/dataGaps), never
      re-deriving or re-analyzing a fresh `AnalysisResult` (BRD Section 68
      still holds: no report is ever a new AI call). New
      `/dashboard/reports` (list) and `/dashboard/reports/[reportId]`
      (full findings/recommendations/data-gaps detail, with a "Generate
      client report" button on `INTERNAL` reports) pages.
- [x] **Audit trail**: `/dashboard/audit` page over the existing (Day 5)
      `listAuditEvents` — action, result, provider/tool, error, timestamp.
      `audit.read` is super_admin-only by default (BRD Section 4.1), so
      this page doubles as a real exercise of the new error boundary
      (below) for every other role.
- [x] **Integration health**: `/dashboard/integrations` page implementing
      BRD Section 34's exact field list — client, provider, connected
      account, health status, last successful sync, last error. (Credential
      expiry isn't tracked in the schema yet, so it's omitted rather than
      faked — noted in the code, not silently dropped.)
      `listIntegrationConnectionsForOrg` extended to select
      `externalAccountId`/`label` for "connected account" (still never
      selects `encryptedCredentials`).
- [x] **Error states**: `src/app/dashboard/error.tsx`, a segment-level
      Next.js error boundary for the whole `/dashboard` tree — renders a
      readable message + "Try again"/"Back to Overview" instead of Next's
      generic crash page whenever a Server Component, Server Action, or
      their data fetching throws (`ForbiddenError`,
      `IntegrationUnavailableError`, `AiGatewayError`, etc.).
- [x] Nav (`src/app/dashboard/layout.tsx`) extended with Reports,
      Integrations, Audit.
- [x] 3 new tests (165 total, up from 162): `getReport`'s ownership check,
      `listReportsForOrg`'s cross-client scoping, and
      `generateClientReportFromInternal`'s redaction + its refusal to run
      on an already-`CLIENT` report.
- [x] End-to-end smoke-verified again with Playwright against a real
      Postgres instance: as super_admin, walked Reports → a report's full
      detail view → clicked "Generate client report" (no crash, a new
      `CLIENT` report was created) → Integrations → Audit, all 200s; then,
      as a `marketing_employee` (who lacks `audit.read`), hit `/dashboard/
      audit` and confirmed the *new error boundary* rendered cleanly
      ("Missing permission: audit.read", Try again, Back to Overview)
      instead of crashing — a real, live exercise of Day 14's "error
      states" requirement, not just a code-reading argument. Fixture data
      and scratch scripts removed afterward; verified no orphaned
      organizations were left behind (the Day 13 workflow-cascade fix
      holds).

### Day 15 — Real client pilot ⚠️ CODE-COMPLETE, PILOT ITSELF BLOCKED ON LIVE CREDENTIALS

A real pilot needs a real `ANTHROPIC_API_KEY`, a deployed environment with its own
`METRICOOL_MCP_URL`/`METRICOOL_API_KEY`, real GA4/GSC OAuth credentials, and a
business decision about which real client to pilot with — none of which exist in
this build environment (`docs/EXTERNAL-APPROVALS.md`). That can't be completed
autonomously. What *was* done, honestly:

- [x] **Closed a real gap found by auditing the codebase against this day's own exit
      criteria**: through Day 14, no code path in the *application* could create a
      real `Client` or connect one to Metricool — only `prisma/seed.ts` and test
      factories could. New `createClient` (`src/lib/clients/create.ts`, gated by
      `clients.manage`) and `connectClientToMetricoolBrand`
      (`src/lib/integrations/metricool/connect.ts`, gated by `integrations.manage`,
      verifies the brand id via a real `getConnectedNetworks` call rather than
      trusting it) close it, with dashboard forms on `/dashboard/clients` and a
      client's detail page. GA4/GSC connection remains deliberately unbuilt — it
      needs a real Google Cloud OAuth app and callback route, and a
      paste-a-raw-token form would be the wrong pattern to ship even as a stopgap.
- [x] **Used the one piece of real external access available in this environment**:
      this session (not the deployed app) has its own live Metricool MCP connection.
      Used it to verify the `MetricoolProvider` adapter's analytics/campaign parsing
      against *real returned data*, not just documented schemas — and found a real,
      previously-undetected bug: `getAnalyticsDataByMetrics` actually returns
      `{ rows: [[...positional values..., "YYYYMMDD"]] }`, not the `fieldId`-keyed
      object the Day 6 adapter assumed. Every metric was silently coming back empty
      on a real connection. Fixed (`src/lib/integrations/metricool/provider.ts`),
      and locked in with new real-shape test cases in
      `tests/unit/metricool-provider.test.ts` — see `docs/INTEGRATIONS.md` and
      `docs/DECISIONS.md` for the full account. This is exactly the class of bug
      mock-only testing structurally cannot catch, and is the strongest argument in
      this whole build for why Day 15 (real data, not just real code) matters.
- [x] Wrote `docs/PILOT-RUNBOOK.md` — the concrete, numbered steps to run a real
      pilot once the prerequisites above exist, plus what to check if something looks
      wrong (a report with no real numbers, a HIGH/CRITICAL item that appears to have
      executed itself, cross-client data appearing) with pointers back to the
      specific tests/mechanisms that should have prevented each.
- [x] 8 new tests (177 total, up from 169): `createClient` permission gating,
      default-policy creation, slug-collision handling, empty-name rejection;
      `connectClientToMetricoolBrand` permission gating, tenant-scoping,
      success-marks-CONNECTED (via a real, not mocked, `getConnectedNetworks` check),
      failure-marks-ERROR-with-the-real-message. Plus the Metricool real-shape tests
      above.
- [x] End-to-end smoke-verified again with Playwright against a real Postgres
      instance: created a real client through the dashboard, connected it to a mock
      Metricool brand through the dashboard (this environment has no
      `METRICOOL_MCP_URL` of its own, so the mock provider correctly served the
      request — verified the resulting `IntegrationConnection` row directly against
      the database: `CONNECTED`, correct label/brandId), and confirmed the
      Integrations page reflects it. Fixture data and scratch scripts removed
      afterward.

typecheck, lint, full test suite (177/177), and production build all pass.

## MVP Exit Criteria (BRD-PRD Section 84)

Legend: **✅ verified** — code-complete, tested, and (where the criterion is
inherently about live behavior) exercised against real external data in this
environment. **🔶 built, mock-verified only** — code-complete and tested, but the
criterion genuinely requires live credentials this environment doesn't have to call
"working" in the full sense the exit criterion means.

- ✅ Real client can be created — `createClient`, Day 15, tested + smoke-verified live
      through the dashboard against a real database.
- ✅ Client data is isolated — tenant isolation (Day 3) + all ten BRD Section 80
      adversarial scenarios (Day 12), tested.
- 🔶 Metricool works for required operations — adapter built (Day 6), its data
      parsing verified and fixed against real live responses (Day 15). Not yet
      live-connected *from the deployed app* (no `METRICOOL_MCP_URL` configured for
      it) — see `docs/EXTERNAL-APPROVALS.md`.
- 🔶 GA4 works — adapter built (Day 7) against the official `googleapis` types and
      tested via mock; no real Google Cloud OAuth app configured anywhere, so never
      exercised against real Google infrastructure.
- 🔶 GSC works — same situation as GA4.
- 🔶 Claude analysis works — AI Gateway orchestration (retries, `ai_runs`
      persistence, structured-output validation) verified against a real database
      with an injected fake Anthropic client (Day 4); never called against the real
      Anthropic API — no `ANTHROPIC_API_KEY` configured anywhere in this environment.
- ✅ Findings are evidence-based — enforced structurally (the AI Gateway's
      structured-output schema requires an `evidence` array per finding, Day 4/9) and
      tested.
- ✅ Recommendations are structured — Zod-validated shape (Day 9/10), tested.
- ✅ Tasks can be created — Day 10, tested, dashboard UI smoke-verified live (Day 13).
- ✅ Approval works — full lifecycle including replay-resistance (Day 10/12), tested,
      dashboard UI smoke-verified live (Day 13).
- ✅ Audit trail works — Day 5, tested, dashboard UI (including its error-boundary
      behavior for the common case of lacking `audit.read`) smoke-verified live (Day
      14).
- ✅ Reports work — generation, `CLIENT`/`INTERNAL` redaction, and deriving one from
      the other (Day 11/14), tested, dashboard UI smoke-verified live.
- ✅ Integration failures are handled — `IntegrationUnavailableError`/data-gap
      reporting (Day 6-9) plus the Day 14 error boundary, tested and smoke-verified
      live (a real `ForbiddenError` from a permission check rendered cleanly, not
      crashed).
- ✅ Cross-client security tests pass — all ten BRD Section 80 adversarial scenarios,
      Day 12, tested.

**Net**: 10 of 13 criteria are fully verified in this environment, including against
real external data where any real access existed. The remaining 3 (Metricool live
app-to-service connectivity, GA4, GSC) are code-complete and tested against
everything short of live credentials — closing them is `docs/PILOT-RUNBOOK.md`'s
job, not further autonomous coding.

## Phase 2 (BRD-PRD Section 85)

### Permission model audit + Client Approval Portal ✅ DONE

Re-read BRD Section 4's per-role capability lists (4.1-4.4) against the actual
seeded `ROLE_PERMISSIONS` and found real gaps - some already flagged in a
since-outdated code comment ("Client User can view/approve/give feedback" - the
permission array underneath didn't grant any of that), some newly discovered:

- **`clients.manage` was overloaded**: it gated both org-wide client *creation*
  (`createClient`, correctly Super-Admin-only per Section 4.1's unscoped "Manage
  clients") and *editing an already-assigned client's* Brain/Policy/brand assets/
  competitors (`src/lib/clients/brain.ts`) - which Section 4.2's "manage assigned
  clients" says Account Manager should be able to do, but couldn't, since they
  never held `clients.manage` at all. Split into `clients.manage` (create, stays
  Super-Admin-only) and a new `clients.edit` (update an accessible client, granted
  to `account_manager` too - `assertClientAccess` still confines it to their
  assigned clients, same as every other scoped permission).
- **New `recommendations.review`**: `acceptRecommendation`/`rejectRecommendation`
  (`src/lib/recommendations/persist.ts`) were gated by `approvals.request` - a
  permission named and documented for the *Approval Engine* (HIGH/CRITICAL tool-
  execution approvals, Account Manager+ only per Section 4.2/4.3), not
  recommendation review. Conflating them meant a `client_user` could never accept/
  reject a recommendation at all, despite Section 4.4 explicitly listing "Review
  recommendations"/"Approve allowed actions". Now its own permission, granted to
  `account_manager`, `marketing_employee`, and `client_user` - the formal Approval
  Engine gate (`approvals.approve`/`approvals.request`) stays exactly as
  restrictive as before, untouched.
- **New `feedback.create`**: `addClientFeedback` was gated by `clients.manage`
  (now `clients.edit`), which `client_user` was never going to hold - yet Section
  4.4 lists "Provide feedback" as a client capability. Split into its own
  permission, granted to `account_manager` and `client_user` (not
  `marketing_employee` - Section 4.3 doesn't list client communication for them,
  kept precise rather than convenient).
- **New `analysis.trigger`, and a real authorization gap closed**: before this,
  `runAnalyzeClientWorkflow` (the paid, real Claude-calling "Analyze this client"
  action) had no permission check of its own beyond client access - a
  `client_user`, who shared the exact same `/dashboard` as staff through Day 14,
  could have clicked the button and spent real AI budget themselves. Section 4.4
  lists no such capability. Added `assertPermission(ctx, 'analysis.trigger')` at
  the top of the workflow (library-level, not just hiding the button), granted to
  `account_manager`/`marketing_employee`/`super_admin` only.
- **CLIENT vs. INTERNAL report leak closed**: `getReport` didn't check report
  `type` against the caller at all - a `client_user` who somehow obtained an
  `INTERNAL` report's id (guessed, shared, an old link) could have read its
  evidence/confidence/dataGaps directly, defeating the entire CLIENT/INTERNAL
  redaction Day 11/41/102 built. `getReport` now refuses any non-`CLIENT` report
  to a `client_user`; `listReports`/`listReportsForOrg` force their effective type
  filter to `CLIENT` for a `client_user` regardless of what's requested, so even
  an unfiltered list call can't surface an `INTERNAL` report's title.
- **A pre-existing correctness bug fixed in passing**: `rejectRecommendation`
  hardcoded the `ClientFeedback.source` it wrote as `'ACCOUNT_MANAGER'`
  unconditionally - harmless while only staff could call it, wrong the moment a
  `client_user` could. Now `ctx.isClientUser ? 'CLIENT' : 'ACCOUNT_MANAGER'`.
- **The Client Portal itself** (`src/app/portal/`): a `client_user` is now
  redirected here from `/dashboard` (and vice versa - `/dashboard/layout.tsx`
  redirects a `client_user` to `/portal`; genuinely separate experiences, not one
  dashboard with hidden buttons). `/portal` (client picker or straight through if
  there's only one, the normal case), `/portal/clients/[clientId]` (recommendations
  with Approve/Decline, CLIENT-only reports list, a feedback form), `/portal/
  reports/[reportId]` (CLIENT report detail), `src/app/portal/actions.ts` (thin
  Server Action wrappers, same pattern as `src/app/dashboard/actions.ts`), and a
  matching `error.tsx`. Implements BRD Section 4.4's list except "View content/
  creative" - no content/creative module exists yet (its own Phase 2 item; add a
  Portal section once `ContentCalendarItem`/`CreativeAsset` get read paths).
- 11 new tests (188 total, up from 177) in `tests/integration/
  client-portal-permissions.test.ts`, covering every permission above in both
  directions (grants what should be granted, still denies what shouldn't be) plus
  the INTERNAL-report-leak fix and the feedback-source fix. All 177 pre-existing
  tests still pass unchanged - every one of them exercises these functions as
  `super_admin`, who holds every permission regardless of the rename.
- End-to-end smoke-verified live with Playwright: a `client_user` signing in lands
  in `/portal` directly (not `/dashboard`); visiting `/dashboard` explicitly
  redirects back to `/portal`; the portal shows the recommendation and an Approve
  button, shows the CLIENT report, and correctly never shows the INTERNAL report's
  title; clicking Approve actually flips the recommendation to `ACCEPTED` (verified
  against the database); submitting feedback actually persists a `ClientFeedback`
  row with `source: CLIENT` (verified against the database, in an isolated retest
  after an initial combined smoke run had a timing false-negative); `super_admin`
  still lands on `/dashboard` normally. Fixture data and scratch scripts removed
  afterward.

typecheck, lint, full test suite (188/188), and production build all pass.

### Social content calendar ✅ DONE

Implements BRD Section 66's `content_calendar` entity and Section 48's MVP
Social Scheduling flow: `src/lib/content-calendar/persist.ts` covers the full
`IDEA -> DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED` lifecycle (`CANCELLED`
reachable from any non-terminal state), gated by a new `content.manage`
permission (`account_manager` + `marketing_employee`, docs/DECISIONS.md has
the full rationale). Scheduling calls the existing `metricool.schedule_post`
Tool Registry entry through `executeTool` - always a Metricool *draft*, never
a real publish (that's the still-open "Automated social scheduling" item
below). New "Content calendar" dashboard page (status-transition actions
across every client), a create-form + read-only card on the client detail
page, and a read-only "Content" card in the Client Portal - which closes the
"View content/creative" gap in BRD Section 4.4 flagged as missing when the
Phase 2 permission audit was done.

Also fixed a real, previously-unnoticed bug found while wiring this in:
nothing in the running app ever called `registerMetricoolTools()`/
`registerGA4Tools()`/`registerGSCTools()`/`registerMarketingAnalyticsAgent()`
outside test suites' own setup - a fresh server process's Tool Registry had
no in-memory implementations registered at all, so `executeTool` would have
thrown `ToolNotFoundError` on the very first tool call in production,
"Analyze this client" included. Fixed with `src/lib/tools/bootstrap.ts`'s
idempotent `ensureToolsRegistered()`, called at the top of every
`executeTool` invocation. docs/DECISIONS.md has the full account.

7 new tests (195 total, up from 188) in `tests/integration/
content-calendar.test.ts` - the full lifecycle, permission checks in both
directions, cross-client denial, the integration-unavailable path (never
fabricates a provider post id, leaves the item APPROVED rather than FAILED),
and a dedicated test proving the bootstrap fix by resetting the tool
registry and calling `executeTool` with no explicit registration call in
that test file. All 188 pre-existing tests still pass unchanged.

End-to-end smoke-verified live with Playwright: connected Client A to
Metricool (mock provider), created a content item as `marketing_employee`,
carried it through submit-for-review/approve/schedule and confirmed a real
Metricool mock draft id came back, then confirmed the Client Portal shows
both items read-only with no action buttons. Fixture data and scratch
scripts removed afterward.

typecheck, lint, full test suite (195/195), and production build all pass.

### SEO workflows ✅ DONE

Implements the SEO Agent (BRD Section 25's "Later" agent list, brought
forward as this Phase 2 item): `src/lib/agents/seo-agent.ts` reads only
Search Console query- and page-level performance (never crawls or audits
anything - BRD Section 49 excludes "Full SEO crawler"/"Advanced SEO
systems") and produces the same structured-recommendation shape every
agent does. `src/lib/workflows/seo-analysis-workflow.ts` mirrors
`analyze-client-workflow.ts`'s persist/route/report/audit pipeline exactly,
with zero new logic - same `analysis.trigger` gate. New "Run SEO analysis"
button on the client detail page (next to "Analyze this client"), and a
`/dashboard/seo` aggregate page listing every SEO Agent recommendation
across clients. Extracted the shared recommendation zod schema out of the
analytics agent into `src/lib/agents/schemas.ts` so both agents share it
rather than duplicating it - pure refactor, no behavior change.

"SEO" recommendations are identified via `AiRun.contextIds.agentKey`
(`src/lib/seo/persist.ts`), not the free-text `area` field, since the
general Marketing Analytics Agent can legitimately also produce an
`area: "SEO"` recommendation as part of an omnibus analysis - the two need
to stay distinguishable. docs/DECISIONS.md has the full account, including
why this is the first use of a Prisma JSON path filter in this codebase.

6 new tests (201 total, up from 195) in `tests/integration/
seo-workflow.test.ts`: agent registration (exactly one LOW-risk tool),
the full gather-analyze pipeline, the no-connection/no-AI-spend path, the
end-to-end workflow (persist + route + a distinctly-titled report), the
`analysis.trigger` permission gate, and - the most important one - proof
that `listSeoRecommendations`/`listSeoRecommendationsForOrg` correctly
exclude a general-agent recommendation with `area: "SEO"` while including
an SEO-agent one. All 195 pre-existing tests still pass unchanged.

End-to-end smoke-verified live with Playwright: the seeded `/dashboard/seo`
page renders and Accept works on a real recommendation; more importantly,
clicked "Run SEO analysis" live on a client with no Search Console
connection and confirmed it completes successfully end-to-end (workflow
runs, a distinctly-titled "SEO Performance Report" appears in Reports) with
zero AI spend - this environment has no `ANTHROPIC_API_KEY` configured, the
same pre-existing constraint "Analyze this client" has always had here, so
the connected/happy path (a real Claude call) is covered by the mocked test
suite instead, not a live click. Fixture data and scratch scripts removed
afterward.

typecheck, lint, full test suite (201/201), and production build all pass.

### More advanced reporting ✅ DONE

Wired up `AnalyticsSnapshot` - present in the schema since Day 1 for
exactly this (BRD Section 69), never actually written to by any code until
now - to give reports real period-over-period metric trends, the "Results"
piece of BRD Section 41's client report structure. `src/lib/analytics/
metrics.ts` turns each agent's already-gathered provider data into
canonical, source-prefixed metric rows (summed for event/count metrics,
*recomputed* rather than averaged for rate metrics like CTR/CPA/ROAS/
position, max-not-sum for the one gauge metric). `src/lib/analytics/
snapshots.ts` compares each new value against the most recent prior
snapshot and persists it. Both the Marketing Analytics Agent and the SEO
Agent now return a `metrics` array; `generateReport` persists + compares
them and attaches the result as `ReportContent.trends`, shown on both
INTERNAL and CLIENT reports via a new `src/components/ui/trend-list.tsx`
(deliberately doesn't color changes green/red - a rising number isn't
always good, e.g. CPA or average position - shows the plain direction and
lets the reader judge). `generateClientReportFromInternal` carries trends
through unchanged.

9 new tests (210 total, up from 201): 7 unit tests in `tests/unit/
analytics-metrics.test.ts` covering the aggregation math directly (sum vs.
weighted-average vs. max semantics, division-by-zero safety, never
fabricating a zero for an unreported metric - one of these caught a real
bug in the first `sum()` implementation, see docs/DECISIONS.md), and 2
integration tests in `tests/integration/reports.test.ts` covering the full
persist-and-compare flow (first report has no prior value, a later one
computes the correct % change, both persisted as real `AnalyticsSnapshot`
rows) and that a metrics-free analysis produces no `trends` field at all.
All 201 pre-existing tests pass unchanged.

End-to-end smoke-verified live with Playwright, through the real
`generateReport()` pipeline (not a raw DB insert): generated two periods
of reports for the same client with realistic metrics, confirmed the
second report's Results section showed correct real percentages (e.g.
sessions 7,100 → 8,400 correctly showing "+18.3%", CPA $18.40 → $14.19
correctly showing "-22.9%" with a down arrow) against hand-verified math,
and confirmed the trends carry through unchanged when generating the
CLIENT-facing version. Fixture data and scratch scripts removed afterward.

typecheck, lint, full test suite (210/210), and production build all pass.

### Competitor analysis ✅ DONE

Implements the Competitor Agent (BRD Section 25's "Later" agent list,
brought forward as this Phase 2 item), plus a prerequisite that turned out
missing entirely: `src/lib/clients/brain.ts`'s `listClientCompetitors`/
`addClientCompetitor` existed since the Client Brain was built but had no
UI - a client's competitors could only be set via a seed script or test.
Added a "Competitors" card (list + add form, gated by the existing
`clients.edit` permission) to the client detail page.

`src/lib/agents/competitor-agent.ts` is architecturally different from
every other agent here: it registers with an empty tool allowlist and
makes zero tool calls, because competitor data (names/URLs/positioning/
observations) is stored directly on the client, never fetched from a
provider - still a real Agent (BRD Section 26) for audit-attribution
consistency, just with nothing to gather beyond what `assembleClientContext`
already assembles. Returns the same `AnalysisResult` shape as every other
agent (`metrics` always `[]` - positioning is qualitative).
`src/lib/workflows/competitor-analysis-workflow.ts` mirrors the SEO/
analytics workflows' persist/route/report/audit pipeline exactly. New
"Run competitor analysis" button on the client detail page - deliberately
no new nav item or aggregate page, since BRD frames competitors as part of
the Client Brain, not a standalone dashboard module.

5 new tests (215 total, up from 210) in `tests/integration/
competitor-workflow.test.ts`: agent registration (empty tool allowlist),
the full analysis pipeline (confirms the stored competitor's data actually
reaches the prompt), the no-competitors/no-AI-spend path, the end-to-end
workflow (persist + route + a distinctly-titled report), and the
`analysis.trigger` permission gate. Competitor CRUD permission behavior
was already covered by existing tests, not re-tested. All 210 pre-existing
tests pass unchanged.

End-to-end smoke-verified live with Playwright: added a competitor
("Rival Marketing Co", with positioning and observations) through the new
UI form on a real client and confirmed it persisted and rendered correctly,
then ran "Run competitor analysis" live on a client with no competitors on
file and confirmed it completes successfully end-to-end with zero AI spend
(same no-`ANTHROPIC_API_KEY` environment constraint as every other agent
workflow here) - a distinctly-titled "Competitor Positioning Report"
appeared in that client's Reports card and the org-wide Reports page.
Fixture data and scratch scripts removed afterward.

typecheck, lint, full test suite (215/215), and production build all pass.

Not yet started from the Phase 2 list (BRD Section 85): Canva creative
workflow, automated social scheduling, a Meta/Google Ads direct
integration, weekly automated intelligence (needs the BullMQ/Redis job
infrastructure `docs/ARCHITECTURE.md` proposes but nothing built yet).
