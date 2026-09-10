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

## 2026-09-10 — Day 11: minimal WorkflowRun/WorkflowStep tracking, not the general Workflow Engine

**Decision:** `src/lib/workflows/runs.ts` implements just enough to give the
"Analyze Client A" workflow (`src/lib/workflows/analyze-client-workflow.ts`)
a durable, auditable run record — `getOrCreateWorkflow`,
`startWorkflowRun`, `recordWorkflowStep`, `completeWorkflowRun` — rather
than building the full Workflow Engine BRD-PRD Section 23 describes
(scheduling, delays, conditions, retries, timeouts, pause/resume as a
generic state machine).

**Rationale:** There is exactly one real workflow to run through the engine
right now. Building generic scheduling/retry/pause-resume infrastructure
against a single caller means guessing at an API shape with no second data
point to validate it against — a classic premature-abstraction risk. The
minimal tracker still satisfies what Section 23 actually requires *today*:
every stage is recorded as a `WorkflowStep` with status transitions
(`RUNNING` → `SUCCEEDED`/`FAILED`/`SKIPPED`), the overall run is durable
and queryable (`WorkflowRun`), and failures are captured with their error
rather than silently swallowed.

**Trade-off accepted:** no scheduling, no automatic retries, no pause/resume
for approval waits (an approval created mid-workflow is a fire-and-forget
side effect the workflow doesn't block on — the workflow's own run
completes once it has created the approval, not once the approval is
decided), no idempotency-key replay protection at the workflow level (Day
10's approval/tool layer already has this for the one place it currently
matters — see `docs/APPROVALS.md`). These are the parts of Section 23 the
MVP does not yet need.

**Revisit if:** a second real workflow (e.g. the creative workflow, BRD
Section 47, or scheduled daily/weekly automation, Section 65) needs the
same shape — generalize `src/lib/workflows/runs.ts` into the full engine
at that point, informed by two concrete call sites instead of one.

---

## 2026-09-10 — Day 11: reports are built from structured `AnalysisResult`, never a fresh AI call

**Decision:** `generateReport` (`src/lib/reports/generate.ts`) transforms
an agent's already-validated `AnalysisResult` into a `ReportContent` shape
in application code. It never asks Claude to re-describe or re-summarize
the numbers into report prose.

**Rationale:** BRD Section 68 explicitly warns against the "Claude guesses
metrics" anti-pattern — a report is a rendering of data that already went
through structured-output validation (Day 4's `zodOutputFormat`) and, for
CLIENT-type reports, a redaction step (dropping `evidence`/`confidence`/
`dataGaps` per Section 41/102's "don't expose internal AI reasoning" rule).
Adding a second AI call to turn that data into a report would spend money
for no informational gain and reintroduce exactly the fabrication risk
Section 68 calls out.

**Revisit if:** product wants a narrative/prose report style beyond
structured findings + recommendations — even then, the better fix is a
templating pass over `ReportContent`, not a fresh model call re-deriving
facts already known and validated.

---

## 2026-09-10 — Day 13: `workflow_runs.workflowId` foreign key changed from RESTRICT to CASCADE

**Decision:** Changed `WorkflowRun.workflow`'s relation from Prisma's implicit
default (`ON DELETE RESTRICT`) to `onDelete: Cascade` (migration
`20260910111038_workflow_run_cascade_delete_on_workflow`).

**Rationale:** Discovered while building the Day 13 dashboard and smoke-testing
it end-to-end: `Organization` cascade-deletes its `Workflow` rows, but
`WorkflowRun.workflowId` had no `onDelete` set, which Prisma/Postgres
resolves to `RESTRICT` — so deleting an `Organization` that has ever run
the "Analyze Client A" workflow (Day 11) failed with a foreign-key
violation. `tests/helpers/factory.ts`'s `cleanupOrg` silently swallows its
own delete error (`.catch(() => undefined)`, needed so parallel test files
don't fail on an already-cleaned-up org), which hid the failure: every
`tests/integration/analyze-client-workflow.test.ts` run left its
Organization/Workflow/WorkflowRun rows behind in the database instead of
actually cleaning up. Confirmed and fixed by querying the dev database
directly (6 orphaned test organizations found, including the Day 2 seed
org `TargetGum Digital Marketing` from an earlier session — restored via
`npx prisma db seed`, which is idempotent and safe to re-run).
`WorkflowRun` rows have no meaning once their `Workflow` definition is
gone, so cascading is the correct behavior here (unlike `Approval` or
`ToolExecution`'s `SetNull` on `workflowRunId`, which are their own durable
records that should survive a workflow run being cleaned up).

**Revisit if:** a product requirement emerges to retain `WorkflowRun`
history independently of its `Workflow` definition (e.g. for long-term
audit even after a workflow is redefined/removed) — that would call for
`SetNull` (making `workflowId` nullable) instead of `Cascade`.

---

## 2026-09-10 — Day 15: fixed a real Metricool parsing bug found via live (not mocked) data

**Decision:** Rewrote `getAnalytics`/`getCampaigns`/`getCampaignPerformance` in
`src/lib/integrations/metricool/provider.ts` to parse `getAnalyticsDataByMetrics`'s
actual response shape (`{ rows: [[...positional values..., "YYYYMMDD"]] }`), replacing
code that assumed a `fieldId`-keyed object.

**Rationale:** This session has its own live, already-connected Metricool MCP
connection (account `info@tapashub.com`), independent of the deployed app's missing
`METRICOOL_MCP_URL`. Day 15's pilot-readiness pass used it to call
`getAnalyticsDataByMetrics` against a real brand (TargetGum, id `6818704`) and compare
the actual response against what the adapter's parsing code expected. They didn't
match: the real shape is an object with a `rows` array of positional value arrays
(numbers as strings, a trailing date), not the `fieldId`-keyed object the Day 6
implementation assumed from documentation alone. The bug was silent - Zod's
`.optional()` on every metric field meant broken parsing produced empty-but-valid
output, not a thrown error, so no test (all built against mocks matching the *wrong*
assumed shape) could have caught it. Only checking against real data did.

**Trade-off accepted:** the `campaigns` connector (ad campaign listing/performance)
is assumed to share the same wire shape as the verified `evolution` connector (same
underlying MCP tool) but wasn't independently confirmed - no brand with a populated,
connected ads account was available in this account. Flagged in
`docs/EXTERNAL-APPROVALS.md` as still needing confirmation once one exists.

**Revisit if:** a populated ads account becomes available and the `campaigns`
connector's real shape turns out to differ from `evolution`'s.

**Broader lesson, applied going forward:** "verified against documented schemas" and
"verified against live data" are different claims - this codebase's docs (Day 6's
original `docs/INTEGRATIONS.md` entry) said the former but read, in places, like the
latter. Every "not live-verified" entry in `docs/EXTERNAL-APPROVALS.md` should keep
being read literally, and any future case where live access to a *read-only* external
system exists (even indirectly, like this session's own Metricool MCP connection)
should be used to check real response shapes before calling an adapter done, not just
its request-building logic.

---

## 2026-09-10 — Day 15: client creation and Metricool connection, missing until now

**Decision:** Added `createClient` (`src/lib/clients/create.ts`, gated by
`clients.manage`) and `connectClientToMetricoolBrand`
(`src/lib/integrations/metricool/connect.ts`, gated by `integrations.manage`,
verifies the brand id via a real `getConnectedNetworks` call rather than trusting it),
plus dashboard forms for both.

**Rationale:** Auditing the codebase against BRD Section 84's MVP Exit Criteria
("Real client can be created") during Day 15 found a real gap: every `Client` row up
to that point came from `prisma/seed.ts` or test factories - `connectClientToProviderAccount`
(`src/lib/integrations/health.ts`, since Day 6) had no caller anywhere in the app
itself. A genuine pilot needs both a real code path to create the pilot client and a
way to connect it to Metricool (which, unlike GA4/GSC, needs no OAuth app - BRD
Section 92/the earlier ORM-style decision above - so this could be a same-request
"connect and verify" action rather than a multi-step OAuth flow).

**Trade-off accepted:** GA4/GSC connection still has no UI - those need a real OAuth
app (Google Cloud client id/secret) and callback route neither of which exist in this
environment (`docs/EXTERNAL-APPROVALS.md`), and pasting a raw refresh token into a
form is the wrong security pattern to build even as a stopgap. Left as documented,
explicitly blocked infrastructure rather than a half-built credential-paste form.

**Revisit if:** a real Google Cloud OAuth app becomes available - build the actual
OAuth consent + callback flow then, not a manual-token form now.

---

## 2026-09-10 — Phase 2: permission model split (`clients.edit`, `recommendations.review`, `feedback.create`, `analysis.trigger`) instead of reusing existing permissions

**Decision:** Added four new permissions rather than reusing `clients.manage`/
`approvals.request` for the Client Portal's needs, and split `clients.manage`'s
two prior meanings (org-wide client creation vs. editing an already-accessible
client) into `clients.manage` (creation, unchanged, Super-Admin-only) and a new
`clients.edit` (editing, now also granted to `account_manager` for their assigned
clients).

**Rationale:** Building the Client Portal (`src/app/portal/`) required deciding
what a `client_user` can do to a recommendation and to feedback. The existing
permissions that gated those actions - `approvals.request` for accept/reject,
`clients.manage` for feedback - were never designed with a client-portal caller in
mind: `approvals.request` is documented and used elsewhere as "Account Manager +
Marketing Employee can request/view [formal Approval Engine] approvals," a
materially different, more sensitive capability (visibility into HIGH/CRITICAL
tool-execution approval requests) than "review and accept/reject a recommendation."
Granting `client_user` (or reusing) `approvals.request` to unblock recommendation
review would have also handed them `listApprovals`/`cancelApproval` - visibility
into the Approval Engine that BRD Section 4.4 never lists and Section 4.2/4.3
reserve for staff. Same problem with `clients.manage` for feedback: it's shared
with Brain/Policy/brand-asset/competitor writes, none of which a client should
touch. Re-reading BRD Section 4.1-4.4's capability lists against the seeded
permission set is what surfaced this - see `docs/MVP-CHECKLIST.md`'s Phase 2
section for the full list of gaps this closed, including a real authorization
hole (nothing stopped a `client_user` from triggering a paid AI analysis run
themselves) and a real data-exposure gap (nothing stopped a `client_user` from
reading an INTERNAL report's evidence/confidence by direct id).

**Trade-off accepted:** four more entries in the `PERMISSIONS` array/more surface
to reason about, versus reusing two already-existing ones. Precision over economy:
a permission whose name and granted-role set don't match what it actually gates is
exactly the kind of drift that produces silent authorization bugs later (this
decision fixed three of them). `marketing_employee` deliberately did NOT get
`feedback.create` or `clients.edit` - BRD Section 4.3 doesn't list client
communication or client management for that role, and "give it anyway, seems
harmless" is exactly the kind of permission creep this pass was cleaning up.

**Revisit if:** a fifth role or a genuinely different recommendation-review flow
(e.g. a client delegate who can review but never decide) needs an even finer split
than `recommendations.review` currently provides.

---

## 2026-09-10 — Design system pass: CSS-variable tokens + a small hand-built component library, not shadcn's CLI

**Decision:** Adopted a proper design token system (HSL CSS variables for
background/foreground/primary/secondary/muted/accent/card/border/ring plus
semantic status colors - success/warning/destructive/info - each with a light
and dark definition), a violet primary brand color, the Inter font via
`next/font/google`, and a small hand-written component library
(`src/components/ui/`: `Button`, `Badge`/`StatusBadge`, `Card`, `Input`/
`Textarea`/`Label`, `EmptyState`, `PageHeader`) plus a sidebar-based dashboard
shell with `lucide-react` icons throughout. Every page in `src/app/dashboard/`
and `src/app/portal/` was rebuilt on these primitives.

**Rationale:** The MVP build (Days 1-15) deliberately used bare Tailwind
utility classes throughout - correct sequencing per `CLAUDE.md`'s "build
incrementally" and the BRD's phased plan, since proving the system worked
mattered more than how it looked. Once asked directly to raise visual
quality, doing it as a real token system rather than one-off color tweaks
per page means every future page automatically matches (badges, cards,
buttons all read from the same palette) and dark mode support is nearly
free (the tokens already have `.dark` definitions, `darkMode: 'class'` was
already configured in `tailwind.config.ts` from Day 1 anticipating this).

**Trade-off accepted:** hand-writing the component library instead of
running the shadcn/ui CLI (`docs/ARCHITECTURE.md`'s originally documented
plan, "shadcn components added on demand") - this environment can `npm
install` packages but the shadcn CLI's registry-fetch flow wasn't verified
here, and the actual components needed (Button/Badge/Card/Input) are a
small, well-understood set not worth the extra dependency surface. Added
`clsx`/`tailwind-merge`/`class-variance-authority` (shadcn's own
dependencies) so a later `npx shadcn add <component>` still drops in
cleanly on top of this if a more complex component (a real Select, a Dialog)
is ever needed.

**Revisit if:** a component with real interaction complexity (a combobox, a
modal, a date range picker) is needed - reach for the shadcn CLI or Radix
primitives directly at that point rather than hand-rolling one.

---

## 2026-09-10 — Palette/typography replacement: warm-neutral + terracotta, replacing the violet token system

**Decision:** Replaced the violet-brand HSL token system from the prior
design-system pass with a fully specified warm-neutral palette (a cream
`--bg-page`/white `--bg-surface`, a three-tier text scale `--text-primary`/
`--text-secondary`/`--text-muted`, a terracotta `--primary` reserved for
CTAs/active nav/key metrics, and five single-purpose status hues - sage
(success), dusty-blue (info), lavender (reserved for future AI-generated-
content badges, not yet wired to any element), mustard (warning), rose
(destructive)). Values are stored as HSL triplets (not hex) so Tailwind's
`bg-x/NN` opacity-modifier syntax keeps working; every triplet renders the
exact hex specified. Added one derived tier not in the source spec: a
darker "-text" reading of each status hue for badge/table text, because the
raw hues are ~2-3:1 contrast on white (too low for small text) - the raw
hue stays the canonical swatch for dots/tints, the darker "-text" variant
(~4.5-6.5:1) is what `success`/`warning`/`destructive`/`info` actually
resolve to. Typography: font-weight capped at 400/500 everywhere
(`font-semibold`/`font-bold` purged from all 18 files that had them),
`uppercase`/`tracking-wide` table headers removed in favor of sentence
case, `StatusBadge` now renders `toSentenceCase(status)` instead of the raw
enum ("IN_PROGRESS" → "In progress"), a new `text-caption` token/utility
added for labels/timestamps/table headers (previously these shared
`text-muted-foreground` with body-secondary text; the spec wants three
distinct tiers), and `tabular-nums` added to every numeric column and stat
value. Dropped the `.dark` token block entirely - grep confirmed zero
`dark:` classes and no theme toggle anywhere in the app, so it was dead
weight duplicating every color for a mode nothing could reach.

**Rationale:** Direct, specific feedback that the violet palette read as
"basic" and the UX as unpolished; the replacement palette, exact hex
values, and typographic rules (weight ceiling, sentence case, a 3-tier text
scale, tabular numerals) were fully specified rather than left to
interpretation, so token-for-token color/typography implementation was the
right scope - explicitly *not* a layout or component-structure change
(confirmed by audit: no hardcoded colors existed anywhere in the codebase
before this pass, so the change is contained to `globals.css`,
`tailwind.config.ts`, and per-file className edits, no JSX restructuring).

**Trade-off accepted:** the exact status hues given (sage/mustard/rose/
dusty-blue) are not text-safe on their own (WCAG contrast 1.9-3.2:1) - held
the literal hex values as canonical swatches per the spec, and derived a
separate darker "-text" stop of the same hue for anywhere that hue is used
as small text, rather than silently substituting a different color or
shipping illegible badges.

**Revisit if:** a real AI-generated-content marker is added to the product
(recommendations already carry `aiRunId`, so this is the obvious next
touchpoint) - wire the reserved `--lavender`/`ai` token to it then, rather
than retrofitting a new color at that point.

---

## Template for future entries

```text
## YYYY-MM-DD — <short title>

**Decision:** ...
**Rationale:** ...
**Alternative(s) considered:** ...
**Revisit if:** ...
```
