# Decisions Log — TargetGum AI Marketing OS

Architectural deviations and stack choices, with rationale, per BRD-PRD Section 125.
Newest entries at the top.

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
