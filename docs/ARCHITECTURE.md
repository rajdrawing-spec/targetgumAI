# Architecture Assessment — TargetGum AI Marketing OS

Status: **The 15-day MVP build plan (`docs/BRD-PRD.md` Sections 81-83) is
complete.** Every module — multi-tenant auth/RBAC, the AI Gateway, the Tool
Registry, the Approval Engine, Metricool/GA4/GSC provider adapters, the
Client Brain + Context Router, the Marketing Analytics Agent, the
"Analyze Client A" workflow (BRD Section 46), a dashboard covering all of
BRD Section 42's implemented nav (Overview, Clients, Recommendations,
Tasks, Approvals, AI Runs, Reports, Integrations, Audit) with a real error
boundary, and real client/Metricool-connection onboarding — is
implemented, tested (see `npm run test` for the current count), and
smoke-verified live against a real Postgres database with a real headless
browser everywhere a UI exists (Days 13-15). All ten BRD Section 80
adversarial security scenarios have dedicated automated coverage (Day 12).
10 of the 13 MVP Exit Criteria (BRD Section 84) are fully verified in this
environment, including against real external data where any real access
existed — Day 15 used this session's own live Metricool MCP connection to
verify the adapter's data parsing against real responses, which found and
fixed a genuine bug no mock-based test could have caught (see
`docs/INTEGRATIONS.md`/`docs/DECISIONS.md`). The remaining 3 (live
Anthropic API, GA4, GSC) are code-complete and tested against everything
short of live credentials, which this environment does not have — see
`docs/EXTERNAL-APPROVALS.md` for exactly what's needed and
`docs/PILOT-RUNBOOK.md` for the concrete steps to run a real pilot once
those credentials exist. See `docs/MVP-CHECKLIST.md` for the full
day-by-day record.

**Phase 2 has started** (BRD Section 85): a permission-model audit against
BRD Section 4's per-role capability lists found and fixed several real gaps
(an authorization hole letting a `client_user` trigger a paid AI analysis
themselves; a data-exposure gap letting a `client_user` read an `INTERNAL`
report's internal reasoning by direct id; `client_user` never actually
being able to review recommendations or give feedback despite BRD Section
4.4 listing both) and split `clients.manage` into creation (unchanged,
Super-Admin-only) vs. editing an already-accessible client (new
`clients.edit`, also granted to `account_manager`). On top of that, the
Client Approval Portal (`src/app/portal/`) gives a `client_user` a
genuinely separate experience from staff's `/dashboard` — reviewing/
approving recommendations, CLIENT-only reports, and feedback — per BRD
Section 4.4. Phase 2's backlog (BRD Section 85) is now complete: social
content calendar, SEO workflows, advanced reporting, a Competitor Agent,
automated social scheduling, native Google Ads/Meta Ads, a Canva creative
workflow, and — the last item — weekly scheduled automation (§4a below),
which is also the first feature in this codebase to need infrastructure
beyond the Next.js app itself (Redis/BullMQ, a separate always-on worker
process). See `docs/MVP-CHECKLIST.md`'s Phase 2 section and
`docs/DECISIONS.md` for the full account of every item.

This document is the architecture assessment and implementation plan requested by
`docs/BRD-PRD.md` Section 116. It proposes the technology stack, repository structure,
database architecture, infrastructure, security risks, integrations, and phased plan.
Rationale for each irreversible-ish choice is recorded in `docs/DECISIONS.md`.

## 1. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript | Server components by default; client components only where interactive |
| Styling | Tailwind CSS + shadcn/ui | shadcn components added on demand, not vendored wholesale |
| Backend | Next.js Route Handlers + Server Actions | No separate service in MVP (BRD Section 9) |
| Database | PostgreSQL 16 | Managed (Neon/Supabase/RDS) in staging/production |
| ORM | Prisma | See `docs/DECISIONS.md#orm` |
| Auth | Auth.js (NextAuth v5) + Prisma adapter, custom TOTP MFA, custom RBAC tables | See `docs/DECISIONS.md#auth` |
| Queue | Redis + BullMQ | Scheduled workflows, AI jobs, integration sync, reports |
| Object storage | S3-compatible (Cloudflare R2 default, AWS S3 supported) | Reports, exports, generated assets |
| Secrets | Environment-variable references + KMS-backed envelope encryption for integration credentials at rest (see `docs/SECURITY.md`) | Production: AWS Secrets Manager / Doppler / Vault (deployment-dependent) |
| AI | Claude via `@anthropic-ai/sdk` | Single provider for MVP (BRD Section 113-114) |
| Validation | Zod | Both AI structured-output validation and API input validation |
| Testing | Vitest (unit/integration/security), Playwright (e2e) | |
| CI/CD | GitHub Actions | Lint → typecheck → tests → build on every PR |
| Hosting | Vercel (app) + managed Postgres (Neon/Supabase, final pick at Day 2 staging setup) + Upstash Redis + Cloudflare R2 | Confirmed with user — see `docs/DECISIONS.md` |
| Observability | Structured logging (pino) + Sentry (error tracking) | |

## 2. Repository Structure

```text
targetgum-ai-marketing-os/
├── src/
│   ├── app/                     # Next.js App Router (routes, layouts, API route handlers)
│   ├── components/ui/           # shadcn/ui components
│   └── lib/
│       ├── auth/                # Auth.js config, password hashing, TOTP MFA, session context
│       ├── rbac/                # role/permission resolution + tenant-access guards (framework-agnostic)
│       ├── crypto/               # envelope encryption for stored secrets (MFA secrets, OAuth tokens)
│       ├── ai/                  # AI Gateway: Claude client, prompt versioning, context assembly
│       ├── agents/               # Orchestrator, Client Intelligence, Analytics, Content, Creative
│       ├── tools/                # Tool Registry + tool implementations
│       ├── workflows/            # Workflow engine (triggers, approvals, retries, idempotency)
│       ├── queue/                # BullMQ queue/worker (Phase 2 - weekly scheduled automation)
│       ├── integrations/
│       │   ├── metricool/        # MetricoolProvider (Social + Ads)
│       │   ├── google-ads/       # Native GoogleAdsProvider (Phase 2)
│       │   ├── meta-ads/         # Native MetaAdsProvider (Phase 2)
│       │   ├── canva/            # CanvaProvider (Creative)
│       │   ├── ga4/              # GA4 AnalyticsProvider
│       │   └── gsc/              # GSC SEOProvider
│       ├── clients/              # Client resolution + Client Brain retrieval
│       ├── creative/             # CreativeAsset persistence/lifecycle (Phase 2)
│       ├── audit/                # Append-only audit event writer
│       └── db/                   # Prisma client singleton, tenant-scoped query helpers
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                   # (added Day 2)
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── e2e/
├── docs/
├── prompts/                       # versioned prompt templates (analytics/, content/, reporting/)
├── scripts/
│   └── worker.ts                  # BullMQ worker entrypoint - a SEPARATE deployable process, see §4a
├── vercel.json                    # Vercel Cron config (weekly-intelligence trigger)
├── .github/workflows/ci.yml
├── .env.example
├── CLAUDE.md
└── README.md
```

This mirrors BRD-PRD Section 75/10 with one adjustment: application modules
(`/social`, `/advertising`, `/analytics`, `/seo`, `/creative`, `/reports`,
`/approvals`, `/tasks`) are implemented as route groups under `src/app/` plus
their supporting logic under `src/lib/`, rather than top-level directories —
this keeps Next.js file-based routing conventional while the module boundary
still exists in `lib/`. Documented as a structural adaptation, not a scope
change.

## 3. Database Architecture (summary — full detail in `docs/DATA-MODEL.md`)

Core hierarchy: `Organization → Users / Clients → (Client Brain, Integrations,
Campaigns, Reports, Tasks, Workflows, Audit Events)`.

Every client-owned table carries `organization_id`, `client_id`, `created_by`,
`created_at`, `updated_at`, and (where relevant) `user_id`, `integration_id`,
`workflow_id`, `ai_run_id`, `approval_id` — per BRD Section 5. Tenant filtering
is enforced in `src/lib/db/` query helpers, never left to callers or the
frontend.

All 43 tables (organizations, users, roles/permissions, clients, client
brain, integrations/integration_accounts/integration_connections, ai_runs,
agents/agent_tools/tool_executions, workflows/workflow_runs/workflow_steps,
tasks, approvals, audit_events, reports, notifications, campaigns/
campaign_metrics, social_posts/social_metrics, seo_metrics,
analytics_snapshots, recommendations, content_calendar, creative_assets) are
specified in `docs/DATA-MODEL.md` and implemented in `prisma/schema.prisma`
(migration `20260910092421_init`, applied and verified against a local
Postgres instance with a seed script — Day 2 of `docs/MVP-CHECKLIST.md`).

## 4. Required Infrastructure

- PostgreSQL 16 instance (per environment: local/dev/staging/production)
- Redis instance (BullMQ) — **implemented (Phase 2, Day 18)**, see "Scheduled
  Automation" below for the deployment topology this actually requires
  (a Vercel-hosted app is not enough on its own)
- S3-compatible object storage bucket
- Secrets manager (or equivalent env-injection mechanism per environment)
- Anthropic API access (Claude)
- Metricool account + API/MCP access for at least one pilot client
- GA4 property + Search Console property access for at least one pilot client
- (Optional, Phase 1) Canva Developer/MCP access
- CI runner (GitHub Actions, included with the repo)
- Error tracking (Sentry or equivalent) — can be deferred past Day 1
- **A small always-on Node host** (Railway/Render/Fly.io/a VM — not Vercel)
  to run `scripts/worker.ts`, the BullMQ worker process — new as of Phase 2's
  scheduled automation, see below

## 4a. Scheduled Automation (Phase 2, BRD Section 65) — implemented

BRD Section 85's Phase 2 backlog named this "Weekly automated intelligence" -
only the weekly cadence is built (daily/monthly are a documented, deliberate
follow-up, not started - see `docs/DECISIONS.md`).

**Why two processes, not one.** Vercel serverless functions return after
each request; there is no "keep polling Redis in the background" primitive
there, so BullMQ's own `Worker` (a long-lived polling loop) cannot run
inside the Vercel-hosted Next.js app itself. The design splits the work
across the two halves the stack already implies:

```text
Vercel Cron (weekly, vercel.json)
  → GET /api/cron/weekly-intelligence (Vercel serverless function)
      - finds clients opted in (ClientPolicy.weeklyAutomationEnabled) and
        not already run in the last 7 days (BRD Section 57 idempotency)
      - enqueues one BullMQ job per client, fast, returns
  → BullMQ queue (Upstash Redis)
  → scripts/worker.ts (a SEPARATE always-on process - Railway/Render/
    Fly.io/a VM, never Vercel) polls the queue and actually runs
    runAnalyzeClientWorkflow for each job
```

**Who a scheduled run acts as.** Rather than inventing a new "system
account" concept, `resolveAutomationActor`
(`src/lib/queue/resolve-actor.ts`) resolves the client's own assigned
`account_manager` (falling back to an assigned `marketing_employee`) and
runs the exact same `runAnalyzeClientWorkflow` a human would trigger by
clicking "Analyze this client" - full authorization/tenant/permission
checks apply unchanged; a client with nobody eligible assigned is skipped
(a `DENIED` audit event, never a fabricated actor). See `docs/DECISIONS.md`
for the full rationale, including why this is not a security exception
(BRD Section 4.5 - even an unattended trigger goes through the exact same
`AuthContext` chain as any human request).

**Local dev**: `npm run worker` runs the worker process against
`REDIS_URL` (a local `redis-server` works fine for development - this
session's own tests exercise a real local Redis, not a mock, since a
mocked queue can't meaningfully prove enqueue/process/retry semantics).
`CRON_SECRET` gates the cron route - required in any environment where
that route is reachable.

## 5. Security Risks Identified (see `docs/SECURITY.md` for the full model)

1. **Cross-tenant data leakage** — mitigated by mandatory `organization_id`/
   `client_id` scoping in every query helper + adversarial tests (BRD Section
   80) before any client-facing feature ships.
2. **Prompt injection via external content** (social comments, scraped pages,
   tool outputs) — mitigated by treating all retrieved content as inert data;
   authorization/approval decisions never derive from model output alone.
3. **Credential exposure** — OAuth refresh tokens and API secrets are never
   sent to Claude and never stored in plaintext; envelope-encrypted at rest.
4. **Unauthorized high-risk actions** (publish, budget change, delete) —
   mitigated by mandatory risk classification + approval gate before any
   write to a provider.
5. **Approval replay / duplicate execution** — mitigated by idempotency keys
   on every external write operation (BRD Section 57).
6. **Over-broad agent tool access** — mitigated by per-agent tool allowlists
   in the Tool Registry; agents cannot self-grant permissions.
7. **Secrets in logs/prompts** — mitigated by structured logging with a
   redaction layer and a lint/test check that fails CI if a prompt builder
   touches a credential field.

## 6. External Integrations & Approval Requirements

See `docs/EXTERNAL-APPROVALS.md` for the live tracker. Summary:

| Integration | Requires external approval before production use? | MVP blocking? |
|---|---|---|
| Claude (Anthropic API) | API key provisioning only | Yes — needed to run any AI workflow |
| Metricool MCP | Account + API access per pilot client | Yes — primary social/ads integration |
| GA4 | OAuth app + property access grant per client | Yes |
| Google Search Console | OAuth app + property access grant per client | Yes |
| Canva MCP | Developer access approval, timeline uncertain | No — optional in MVP, degrades gracefully |
| Google Ads / Meta / Amazon Ads (native APIs) | Developer token / app review / API access approval | No — Phase 2+ |

Development proceeds against mock providers (BRD Section 91-92) wherever a
credential or approval is pending, so the workflow can be built and tested
end-to-end before real accounts are connected.

## 7. Phased Implementation Plan

Mirrors `docs/BRD-PRD.md` Sections 81-84, tracked live in `docs/MVP-CHECKLIST.md`:

- **Week 1 — Foundation**: repo scaffold (this delivery) → database/org/user/client
  schema → auth/RBAC/tenant isolation → AI Gateway/Claude integration → tool
  registry/permissions/audit.
- **Week 2 — Intelligence**: Metricool provider → GA4/GSC → Client Brain →
  Analytics Agent → recommendation/task/approval engine.
- **Week 3 — End-to-end MVP**: the "Analyze Client A" workflow, security
  testing, dashboard, reporting/audit, real client pilot.

No application features (agents, providers, workflows, dashboard beyond a
shell) are implemented before this architecture document is reviewed, per
BRD-PRD Section 116.

## 8. Open Questions — resolved

Resolved with the user on 2026-09-10:

- **Hosting**: Vercel + managed Postgres (Neon/Supabase) + Upstash + R2 (Section 1).
- **Metricool ads scope**: confirmed available for read/analysis (all networks
  including Google/Meta Ads metrics schema), not available for write/management —
  see `docs/DECISIONS.md` and `docs/INTEGRATIONS.md`. Ads write/management is
  deferred to a native Phase 2 adapter if ever required; it does not block MVP.
- **Pilot credentials** (Anthropic API key, GA4/GSC property access, Metricool
  brand confirmation): provided incrementally by the user as each integration is
  reached (Day 4, 6, 7) — development proceeds against mock providers until then.
- **Proceed past Day 1 review gate**: user confirmed — Day 2 (full schema/
  migrations) is implemented as part of this delivery. See `docs/MVP-CHECKLIST.md`.

Still open, not blocking: final choice between Neon vs. Supabase for managed
Postgres (defer to whenever staging is first provisioned); which pilot client
maps to which Metricool brand (needed before Day 6).
