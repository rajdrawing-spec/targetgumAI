# Decisions Log — TargetGum AI Marketing OS

Architectural deviations and stack choices, with rationale, per BRD-PRD Section 125.
Newest entries at the top.

---

## 2026-09-10 — Approval Engine replaces the Day 5 hard block via ApprovalRequiredError, not silent execution (Day 10)

**Decision:** `executeTool()`'s risk gate no longer throws `RiskLevelBlockedError`
unconditionally for HIGH/CRITICAL tools. It now creates a `PENDING` `Approval` row
(`src/lib/approvals/approvals.ts`) and throws `ApprovalRequiredError` carrying the
approval's id. A new `executeApprovedTool(ctx, approvalId)` re-runs the same
authorization chain (permissions, client access, agent allowlist all re-checked —
only the risk-level gate is skipped, since the approval itself is that decision) once
a human calls `approveApproval`, and marks the approval `EXECUTED`/`FAILED` based on
the outcome. `RiskLevelBlockedError` is retained only for the case where no
`clientId` was given (an `Approval` requires one — BRD Section 22) or approval
creation itself fails — a HIGH/CRITICAL call must never execute unchecked, so denial
is still the fallback, just no longer the *only* path.

**Rationale:** This is exactly what Day 5's `RiskLevelBlockedError` comment promised:
"Day 10 replaces this hard block with a real approval gate." Building the engine now
was the point of doing Day 5's honest-denial-over-fabricated-approval trade-off in
the first place.

**Consequence for existing tests**: `tests/security/tool-authorization.test.ts`'s
HIGH-risk test was updated to assert `ApprovalRequiredError` + a real `PENDING`
approval row, instead of the old unconditional `RiskLevelBlockedError` — this is a
behavior change on purpose, not a regression; see the test's own history in the same
commit.

---

## 2026-09-10 — Added a distinct `tasks.create` permission, not reused `clients.manage` (Day 10)

**Decision:** `src/lib/rbac/permissions.ts` gained a new permission key,
`tasks.create`, granted to `account_manager` and `marketing_employee` (and
`super_admin`), not `client_user`.

**Rationale:** BRD-PRD Section 4.2-4.4 lists "Create tasks" as an Account
Manager/Marketing Employee capability, not tied to client configuration authority
(`clients.manage`, which only `super_admin` holds in the seeded set) and not granted
to Client User. Reusing `clients.read` would have wrongly let Client User create
tasks too (everyone with `clients.read` could); reusing `clients.manage` would have
wrongly blocked Marketing Employee, who BRD explicitly says can create tasks.
A dedicated permission was the only option that matched BRD's actual role table.

---

## 2026-09-10 — ClientBrain sections fetched as a full row, not per-column Prisma `select` (Day 8)

**Decision:** `getClientBrainSection(s)` (`src/lib/clients/brain.ts`) runs
`db.clientBrain.findUnique({ where: { clientId } })` and picks fields off the result,
rather than `select: { business: true }` etc.

**Rationale:** `docs/DATA-MODEL.md`'s original design note anticipated column-level
`select` as how the Context Router would avoid loading the whole brain. In practice,
`ClientBrain` is one row of at most 4 JSON blobs per client - the realistic content
here (business/audience/brand/marketing notes for one client) is nowhere near large
enough for the `select`-vs-fetch-all difference to matter at Postgres query time, and
fetching the full row keeps the code simple (no per-section switch/case or unsafe
dynamic key typing). The actual thing that matters for BRD Section 7 - not injecting
the whole brain into a prompt - is enforced at the Context Router level
(`assembleClientContext` only returns the sections a category needs), which is
what's actually tested.

**Revisit if:** ClientBrain sections grow large enough (e.g. a business section with
years of accumulated free-text history) that column-level `select` becomes a real
DB-side saving - switch `getClientBrainSection(s)` to per-column `select` at that
point; callers don't need to change.

---

## 2026-09-10 — GA4/GSC providers are resolved per-connection, not per-organization (Day 7)

**Decision:** `resolveGA4Provider`/`resolveGSCProvider` take the resolved
`IntegrationConnection` (via `withIntegrationHealthTracking`'s callback) and decide
mock-vs-real per call, rather than a static `getGA4Provider()` factory like
Metricool's `getMetricoolProvider()`. This required widening
`withIntegrationHealthTracking`'s callback signature from `(externalAccountId:
string)` to `(connection: ResolvedProviderConnection)` — Metricool's tool
registrations were updated to destructure `connection.integrationAccount.
externalAccountId` themselves; behavior is unchanged for Metricool, all its tests
still pass.

**Rationale:** Metricool authenticates with one org-wide API key — the same
provider instance works for every client's brand, so a static factory made sense.
GA4/GSC authenticate per-client via OAuth (each client's Google Analytics/Search
Console property is authorized separately, producing a distinct refresh token per
`IntegrationConnection`) — there is no single "the GA4 provider" for an org, only
"the GA4 provider for this specific client's connection." Passing the connection
through is what makes that possible without a redundant DB lookup inside the
resolver.

**Consequence for future providers**: an org-wide-credential provider (like
Metricool) can ignore the connection object's credentials and just read
`externalAccountId`; a per-client-OAuth provider (like GA4/GSC, and any future
native Ads API using OAuth) uses `loadProviderCredentials(connection)` too. Both
shapes are supported by the same `withIntegrationHealthTracking` signature now.

---

## 2026-09-10 — GA4/GSC use the official `googleapis` client library (Day 7)

**Decision:** `src/lib/integrations/ga4/provider.ts` and `gsc/provider.ts` call the
GA4 Data API (`analyticsdata.properties.runReport`) and Search Console API
(`searchconsole.searchanalytics.query`) via Google's official `googleapis` npm
package, rather than hand-rolled `fetch` calls against the REST endpoints.

**Rationale:** Unlike Metricool (a bespoke MCP surface that had to be verified live
rather than guessed), GA4 and Search Console are Google's own stable, long-documented
public REST APIs with an official, actively-maintained Node client. Method names,
request/response shapes were checked against the *installed package's own TypeScript
definitions* (`node_modules/googleapis/build/src/apis/{analyticsdata,searchconsole}/
*.d.ts`) before writing the adapters — not recalled from training data — so the same
"never guess SDK usage" discipline applies, just resolved by reading the installed
library instead of a live connection.

**Trade-off accepted**: because `googleapis`' generated API clients don't expose an
easy way to inject a fake HTTP transport, the real adapters' request/response mapping
logic isn't independently unit-tested the way Metricool's is (which has a clean MCP
client injection seam). This is a real, documented gap — see docs/MVP-CHECKLIST.md —
not swept under the rug. Adding an HTTP-mocking library (e.g. `nock` or `msw`) would
close it; deferred to keep this day's scope bounded.

---

## 2026-09-10 — Metricool adapter connects via a real MCP client, not Metricool's REST API (Day 6)

**Decision:** `src/lib/integrations/metricool/mcp-client.ts` implements
`MetricoolProvider` as an MCP client (`@modelcontextprotocol/sdk`, Streamable HTTP
transport) connecting to `METRICOOL_MCP_URL`, rather than calling an assumed
Metricool REST API directly.

**Rationale:** BRD-PRD Section 15 explicitly names "Metricool MCP" throughout, and
this session has a live, verified Metricool MCP connection (`Metricool_Social_Media_
Management`) with a confirmed tool surface (checked live during Day 1 — see the
Metricool findings entry below and docs/INTEGRATIONS.md). Guessing at Metricool's raw
REST API shape from training data would violate "never guess SDK usage" / "do not
assume external APIs are available until verified" (BRD Section 116) — building
against the verified MCP tool schemas instead means every request this adapter
constructs is checkable against something real, not invented.

**What is and isn't verified**: the tool *names and input schemas* are verified
(fetched live via this session's own Metricool MCP connection). The *transport
connection itself* — a real `METRICOOL_MCP_URL` + `METRICOOL_API_KEY` reachable from
the deployed application — is not, since no such URL/key has been provided to this
environment. The auth header shape (`Authorization: Bearer <key>`) is a reasonable
default, not confirmed. See docs/EXTERNAL-APPROVALS.md.

**Revisit if**: once real connection details are available and a live test reveals a
different transport (e.g. SSE instead of Streamable HTTP) or auth scheme, update
`mcp-client.ts` accordingly — the rest of the adapter (`provider.ts`) doesn't need to
change, since it only depends on `callMetricoolTool()`'s contract.

---

## 2026-09-10 — Metricool's `schedulePost`/`createPost` always send `draft: true` (Day 6)

**Decision:** Regardless of what `SocialPostInput` the caller provides,
`MetricoolProvider.createPost`/`.schedulePost` always set `draft: true` (and
`autoPublish: false`) in the Metricool `createScheduledPost` payload. Verified by a
dedicated test (`tests/unit/metricool-provider.test.ts`) that asserts this on every call.

**Rationale:** Metricool's `autoPublish: true` would let Metricool itself publish the
content automatically at the scheduled time, with no further TargetGum approval step
— which would make `schedulePost` (classified MEDIUM risk, BRD Section 21 "prepare
scheduled content") a disguised HIGH-risk "publish" action. Since there's no Approval
Engine yet (Day 10) and the Day 5 Tool Registry already hard-blocks HIGH/CRITICAL
tools, keeping `schedulePost` honestly MEDIUM means forcing Metricool into a fully-held
draft state — nothing this adapter does can cause a real-world publish.
`publishPost` is correspondingly unimplemented (`UnsupportedOperationError`): making
an existing draft actually go live is exactly the HIGH-risk operation that needs Day
10's Approval Engine, not something to enable quietly through a MEDIUM-risk tool.

**Revisit**: Day 10, when a real HIGH-risk `publishPost`-equivalent tool can exist
behind the Approval Engine.

---

## 2026-09-10 — HIGH/CRITICAL-risk tools are hard-blocked until the Approval Engine exists (Day 5)

**Decision:** `executeTool()` throws `RiskLevelBlockedError` for any tool whose
`riskLevel` is HIGH or CRITICAL — unconditionally, even for super_admin — rather than
executing it or silently no-op'ing.

**Rationale:** BRD-PRD Section 21 defaults HIGH to "approval required" and CRITICAL
to "approval always required, no override." The Approval Engine that would actually
route such a request to a human doesn't exist until Day 10. Building a partial/stub
approval flow now would be worse than an honest hard block: a stub invites someone to
assume approvals are enforced when they aren't. Denying outright is the only option
consistent with "approval before risk" (BRD Section 3.4) given what's built so far.

**Revisit:** Day 10 replaces this hard block with a real gate — HIGH/CRITICAL calls
create a `PENDING` `Approval` row and wait, rather than deny immediately.

---

## 2026-09-10 — Agent/Tool registration uses find-then-create/update, not `upsert` (Day 5)

**Decision:** `registerTool()` and `registerAgent()` do `findFirst({ organizationId:
null, key })` then `create` or `update`, rather than `db.tool.upsert({ where: {
organizationId_key: { organizationId: null, key } } })`.

**Rationale:** `Tool` and `Agent` use `@@unique([organizationId, key])` for tenant-
scoped tools, but system-wide tools/agents have `organizationId: null` — and Postgres
does not enforce uniqueness across multiple NULLs in a compound unique index. Prisma's
compound-unique `upsert`/`findUnique` still *works* as a read (`WHERE organization_id
IS NULL AND key = ?`), so this isn't broken today, but the DB-level constraint can't
actually stop two racing `registerTool()` calls from creating two system-wide rows
with the same key. Acceptable for now because registration happens idempotently at
single-process startup (never concurrent) — flagged here because it's a real gap if
registration ever needs to be concurrency-safe (e.g. multiple server instances booting
simultaneously and racing to register the same built-in tool).

**Revisit if:** that concurrency scenario becomes real — add a Postgres partial unique
index (`CREATE UNIQUE INDEX ... ON tools (key) WHERE organization_id IS NULL`) via a
raw-SQL migration, since Prisma's schema DSL can't express a partial index directly.

---

## 2026-09-10 — AI Gateway uses named model tiers, not a single hardcoded model (Day 4)

**Decision:** `src/lib/ai/models.ts` defines three tiers — `fast` (Haiku 4.5), `default`
(Sonnet 5, overridable via `ANTHROPIC_DEFAULT_MODEL`), `reasoning` (Opus 5) — and every
AI Gateway call picks a tier, never a raw model string.

**Rationale:** BRD-PRD Section 73 explicitly asks for cost control by client/workflow/
model and to "use cheaper/faster models where appropriate and reserve stronger
reasoning models for tasks that benefit from them." This is a multi-tenant product
running routine analysis for many clients — unlike a one-off engineering task, per-run
model cost compounds across clients and cadence (BRD Section 65's daily/weekly/monthly
scheduled workflows). Centralizing the tier→model mapping in one file means a future
model swap (e.g. a new Haiku release) is a one-line change, not a grep-and-replace.

**Model IDs used:** `claude-haiku-4-5-20251001` (fast), `claude-sonnet-5` (default),
`claude-opus-5` (reasoning). The Haiku ID carries a date suffix while the other two
don't — that's deliberate, matching what this environment's own model-identity
reference gives for Haiku 4.5 specifically (not a copy-paste error).

**Pricing** (USD per 1M tokens, for `estimateCostCents`): Haiku 4.5 $1.00/$5.00,
Sonnet 5 $2.00/$10.00, Opus 5 $5.00/$25.00. These will drift as Anthropic updates
pricing — there's no live pricing API to poll, so refresh this table by hand
(re-consult current Anthropic pricing) when it's noticed to be stale, and note the
update here.

**Which agent uses which tier is not decided yet** — that's a Day 9+ (Analytics
Agent) decision once there's a real workload to tune against, not something to guess
at while building the gateway itself.

---

## 2026-09-10 — Structured outputs via native `output_config.format`, not tool-choice forcing (Day 4)

**Decision:** `runStructuredAiTask` uses `client.messages.parse()` with
`output_config: { format: zodOutputFormat(schema) }` — Anthropic's native structured-
output feature — rather than the older pattern of defining a fake "tool" and forcing
`tool_choice` to get JSON back.

**Rationale:** This is the SDK's own recommended approach for schema-constrained
output (confirmed against the bundled Claude API reference, not assumed from
training). It's simpler, and `response.parsed_output` is either the validated,
correctly-typed object or `null` — no manual `JSON.parse` + Zod `.safeParse` dance,
and no risk of the model narrating outside a tool call.

**Gotcha this forced:** `zodOutputFormat()` requires schemas built from `zod/v4`
specifically (the SDK's typing imports `zod/v4`, not the classic `zod` v3 API this
project uses everywhere else, e.g. `src/lib/auth/config.ts`'s credentials schema).
The installed `zod` package (^3.24, resolved to 3.25.x) ships both APIs under one
package — `import { z } from 'zod'` for everything else, `import { z } from 'zod/v4'`
only inside `src/lib/ai/` for schemas passed to the gateway. This is a real footgun
for future contributors: **a schema built with the classic `zod` import will not
satisfy `zodOutputFormat`'s type**, and the two APIs are similar but not identical
(error customization especially differs). Flagged here rather than only in a code
comment because it's easy to miss.

---

## 2026-09-10 — Session strategy: JWT, not database (Day 3)

**Decision:** `session.strategy = 'jwt'` in the Auth.js config, even though the
Prisma schema has a `Session` table.

**Rationale:** Auth.js's Credentials provider is only supported with JWT sessions —
sign-ins through it aren't persisted to the adapter's `Session` table the way OAuth
sign-ins are, and Auth.js throws a configuration error if you set `strategy:
'database'` while a Credentials provider is registered. The `Session`/
`VerificationToken` models stay in the schema: `VerificationToken` is actively used
by the Nodemailer (magic-link) provider regardless of session strategy, and `Session`
is ready for a future OAuth provider that could use database sessions if one is added.

**Trade-off accepted:** sessions can't be server-side-revoked by deleting a DB row
(they're self-contained encrypted JWTs, valid until expiry). If instant revocation
becomes a requirement (e.g. "kick this user out immediately"), that needs either a
short JWT `maxAge` + a denylist check in the `session` callback, or dropping
Credentials in favor of an OAuth-only + database-session setup.

---

## 2026-09-10 — No Next.js middleware for route protection (Day 3)

**Decision:** `/dashboard` (and future protected routes) enforce auth via a
`redirect()` check at the top of each server component (see
`src/app/dashboard/page.tsx`), not `middleware.ts`.

**Rationale:** Auth.js's documented pattern for edge-compatible middleware requires
splitting the config into an edge-safe partial (no Prisma adapter, no
Node-only `bcryptjs`/`otpauth` in the `authorize` callback) and a full Node.js config
used everywhere else — real complexity for one extra layer of defense, given every
protected page already calls `getCurrentAuthContext()` and redirects. Page-level
guards are enforced today and verified live (unauthenticated `/dashboard` → 307 to
`/sign-in`, confirmed via `curl`).

**Revisit if:** the protected-route surface grows large enough that repeating the
guard per-page becomes error-prone (a forgotten guard is a real vulnerability) — at
that point, either build the edge-safe split properly, or force Next.js middleware
onto the Node.js runtime (stable as of Next 15.2+) so the full config can be reused
without an edge-compatibility rewrite.

---

## 2026-09-10 — Password hashing: bcryptjs over argon2/native bcrypt

**Decision:** `bcryptjs` (pure JS, cost factor 12) for password hashing.

**Rationale:** No native bindings to compile — one less thing to break across the
range of environments this repo will run in (local dev, CI, various hosting
platforms). Argon2 is the stronger modern choice on paper, but its native dependency
has repeatedly been a source of build friction in Node/serverless environments;
bcrypt's security margin is still adequate for this product's threat model at MVP
stage.

**Revisit if:** a security review specifically calls for Argon2id, or password
hashing throughput becomes a measured bottleneck.

---

## 2026-09-10 — MFA: `otpauth` (TOTP) with envelope-encrypted secrets; recovery codes not yet persisted

**Decision:** `src/lib/auth/mfa.ts` generates/verifies TOTP codes via `otpauth`
(pure JS). The secret is envelope-encrypted (`src/lib/crypto/envelope.ts`) before
`User.mfaSecret` is ever written — `generateMfaSecret` returns the plaintext only for
one-time QR/manual-entry rendering during enrollment; callers must persist only
`encryptedSecret`. `generateRecoveryCodes` exists but nothing yet stores or verifies
them against a "used" state — no `RecoveryCode` table exists.

**Rationale:** Auth.js has no built-in MFA (see the Day-1 auth decision above); TOTP
is the standard second factor and `otpauth` avoids a native-binding dependency.
Recovery codes were scoped out of Day 3 to keep the slice reviewable — shipping the
core enroll/verify loop now, with recovery-code persistence tracked as a named gap in
`docs/SECURITY.md` rather than silently deferred.

**Revisit before this MFA flow is offered to real users:** add a `RecoveryCode`
table (hashed, single-use) and enrollment/recovery UI.

---

## 2026-09-10 — Prisma naming: camelCase fields, `@@map` to snake_case tables

**Decision:** `prisma/schema.prisma` uses idiomatic Prisma/TypeScript camelCase field
names (`organizationId`, `clientId`, `createdAt`) rather than the literal snake_case
shown in `docs/BRD-PRD.md`'s illustrative pseudocode. Table names are mapped to
snake_case via `@@map` (e.g. `model AuditEvent` → table `audit_events`) so the
physical schema still reads the way the BRD's examples do.

**Rationale:** BRD Section 32's pseudocode (`organization_id`, `client_id`, ...) is
describing required columns conceptually, not mandating literal casing. camelCase is
the Prisma/TS convention and avoids `@map` boilerplate on every field.

---

## 2026-09-10 — Full Data Model schema implemented (Day 2)

**Decision:** Implemented all 43 tables from `docs/DATA-MODEL.md` as the initial
Prisma migration (`prisma/migrations/20260910092421_init`), applied against a local
Postgres 16 instance and verified with a seed script (org + 4 system roles + starter
permission set + one sample client). `npm run typecheck`, `lint`, `test:unit`, and
`build` all pass against the generated client.

**Notable modeling choices not spelled out in the BRD:**
- `ClientBrain` stores `business` / `audience` / `brand` / `marketing` as validated
  JSON columns (one row per client) rather than seven separate tables, so the Context
  Router can select a single column without loading the whole brain (see
  `docs/DATA-MODEL.md`). Competitors, feedback, brand assets, and policy get real
  tables because they're listed, enforced, or queried individually.
- `ClientPolicy` fields that gate the Approval Engine (`maxDailyAdBudget`,
  `maxBudgetChangePercent`, `autoPublishSocial`, `autoChangeAds`,
  `requireApprovalForCampaignLaunch`) are typed columns, not JSON, plus an `extra`
  JSON overflow field for policy knobs not yet promoted to a column.
- Normalized metric tables (`CampaignMetric`, `SocialMetric`, `SeoMetric`,
  `AnalyticsSnapshot`) each carry `source` / `retrievedAt` / `period` provenance
  columns plus a `raw` JSON column preserving the original provider payload, per BRD
  Section 37/69.
- `AuditEvent` has no update/delete path in application code (append-only by
  construction); a DB-level `REVOKE UPDATE, DELETE` for the app role is still
  pending a hosting decision on how the app's DB role is provisioned — tracked in
  `docs/SECURITY.md`.
- Auth.js v5's required `Account` / `Session` / `VerificationToken` models are
  included now (Day 2) even though auth itself lands Day 3, so the schema doesn't
  need a second migration just to add them.

**Revisit if:** ClientBrain's JSON sections need per-field query/index performance
that column-level Prisma `select` can't give (e.g. searching within `business.industry`
at scale) — split into typed sub-tables at that point.

---

## 2026-09-10 — Hosting confirmed: Vercel + managed Postgres + Upstash Redis + Cloudflare R2

**Decision:** User confirmed the proposed default in `docs/ARCHITECTURE.md` — Vercel
for the app, a managed Postgres provider (Neon or Supabase, final pick deferred to
Day 2 staging setup), Upstash for Redis/BullMQ, Cloudflare R2 for object storage.

**Status:** Confirmed for staging/production. Local development in this repo uses a
local PostgreSQL 16 instance (see `.env.local`, gitignored) — no hosted resources are
provisioned yet.

---

## 2026-09-10 — Metricool MCP: ads read/analysis confirmed available; ads write/management not exposed by this MCP

**Decision:** Proceed with Metricool for ads *analysis* (read) in the MVP workflow;
do not plan on Metricool for ads *management* (write) — that capability isn't present
in this MCP server's tool surface at all, independent of account plan.

**Findings (checked live against the connected Metricool MCP in this environment,
account owner `info@tapashub.com`):**
- `getAnalyticsDataByMetrics` / `getAnalyticsAvailableMetrics` support `network`
  values including `googleAds`, `metaAds`, `facebookAds`, `tiktokAds` with a full
  metrics schema (spend, impressions, clicks, conversions, CPC, CPM, CTR, ROAS) at
  both account-evolution and per-campaign granularity — this covers the MVP
  "Analyze Client A's ads performance" workflow (BRD Section 19: read-only analysis,
  no modification).
  Note: this metric-schema check does not need write access to an ad
  account - it worked even though no Google Ads account is currently connected
  (see below), so its presence alone doesn't guarantee a given client's data is
  populated. Verify per-client before relying on it for a pilot.
- No campaign/budget/bid write endpoints exist in this Metricool MCP's tool list at
  all (only `createScheduledPost` / `updateScheduledPost` / `sendScheduledPostForReview`
  for **social**, nothing ads-equivalent). This is a property of the MCP server, not
  something an account upgrade would unlock. Matches BRD Section 20's framing of ads
  optimization/execution as later, policy-gated work anyway — not a Day 6 blocker.
- Five brands are connected on this account: **HUGFAB**, **LHO** (Facebook Ads
  connected, account `act_27530167156623376`), **TargetGum**, **undertreegames**
  (Facebook Ads connected, `act_1250233737082703`), **Pepalworks**. None currently
  have a Google Ads account connected in Metricool.
- Implication for the pilot: if the pilot client maps to **LHO** or
  **undertreegames**, Facebook/Meta Ads read analysis is available today. If it needs
  Google Ads specifically, that requires either connecting a Google Ads account to
  the relevant Metricool brand, or a native Google Ads API integration (Phase 2, BRD
  Section 52) for that one channel.

**Revisit if:** ads write/management becomes a real MVP requirement — that's a native
`GoogleAdsProvider`/`MetaAdsProvider` (Phase 2), not something to wait on Metricool for.

---

## 2026-09-10 — Repository structure adapts BRD Section 75/10 module list to Next.js conventions

**Decision:** Application modules (`/social`, `/advertising`, `/analytics`, `/seo`,
`/creative`, `/reports`, `/approvals`, `/tasks`, `/settings`, etc.) are implemented as
route groups under `src/app/` plus supporting logic under `src/lib/`, rather than as
top-level directories.

**Rationale:** Next.js App Router expects routes under `app/`. Keeping the module
boundary in `lib/` (one subfolder per module) preserves the intent of BRD Section 10
(no separate deployable services, clear module boundaries) without fighting the
framework's routing conventions.

**Alternative considered:** Literal top-level `/social`, `/advertising`, etc.
directories outside `src/`. Rejected — would require custom routing glue with no
benefit over App Router route groups.

---

## 2026-09-10 — ORM: Prisma

**Decision:** Prisma over Drizzle for the initial schema and all query access.

**Rationale:** BRD Section 9 leaves the choice open but asks it be documented. Prisma
was chosen for: mature migration tooling (`prisma migrate`) that fits the "keep
migrations small and reviewable" rule in `CLAUDE.md`; generated types that pair well
with the tenant-scoped query-helper pattern in `src/lib/db/`; and broad familiarity,
which matters for a small team maintaining this long-term. Drizzle's lighter runtime
and closer-to-SQL feel are real advantages but not decisive at this stage.

**Revisit if:** query performance at scale becomes a bottleneck Prisma's query engine
can't address, or the team wants more direct SQL control.

---

## 2026-09-10 — Auth: Auth.js (NextAuth v5) + Prisma adapter + custom TOTP MFA + custom RBAC

**Decision:** Self-hosted auth using Auth.js v5 with the Prisma adapter for
sessions/accounts, credentials + magic-link (email) providers, a custom TOTP-based MFA
layer (Auth.js has no built-in MFA), and a custom RBAC schema (`roles`, `permissions`,
`organization_users`, `client_users`) rather than a third-party auth platform.

**Rationale:** BRD Section 9 requires email/password or magic link, OAuth capability,
MFA, session management, and RBAC. A turnkey platform (Clerk, WorkOS, Auth0) would give
MFA and session management out of the box but would fight the custom multi-tenant RBAC
model this product needs (organization-level + client-level permissions, agent
authorization checks reusing the same permission resolution as human users — BRD
Section 31). Keeping auth data in our own Postgres also keeps tenant-isolation testing
(BRD Section 80) inside one system instead of split across our DB and a vendor's.

**Trade-off accepted:** more auth code to write and test ourselves (MFA enrollment,
recovery codes, session revocation) versus a vendor's polished flows. Mitigated by
budgeting explicit test coverage for this in Day 3 (`docs/MVP-CHECKLIST.md`).

**Revisit if:** the team wants SSO/SAML for enterprise clients sooner than Phase 2 —
a vendor platform becomes more attractive at that point.

---

## 2026-09-10 — Hosting target: proposed, not yet decided

**Status:** Open. `docs/ARCHITECTURE.md` proposes Vercel + managed Postgres (Neon/
Supabase/RDS) + Upstash Redis + Cloudflare R2 as a default low-ops baseline consistent
with BRD Section 94 ("managed Postgres, managed Redis, managed object storage, secure
hosting"), but this has not been confirmed with the user. See open questions.

---

## Template for future entries

```text
## YYYY-MM-DD — <short title>

**Decision:** ...
**Rationale:** ...
**Alternative(s) considered:** ...
**Revisit if:** ...
```
