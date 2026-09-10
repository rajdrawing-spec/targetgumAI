# Architecture Assessment — TargetGum AI Marketing OS

Status: **Foundation (Day 1), full database schema/migrations (Day 2),
authentication/RBAC/tenant isolation (Day 3), and the AI Gateway (Day 4)
complete** — Day 3 verified live via a manual end-to-end sign-in flow; Day 4
verified via a mocked-client integration suite against a real database (no
live Anthropic API call yet — no API key configured in this environment, see
`docs/EXTERNAL-APPROVALS.md`). See `docs/MVP-CHECKLIST.md` for current
progress. Day 5 (Tool Registry, permission system, audit events) is next.

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
│       ├── integrations/
│       │   ├── metricool/        # MetricoolProvider (Social + Ads)
│       │   ├── canva/            # CanvaProvider (Creative)
│       │   ├── ga4/              # GA4 AnalyticsProvider
│       │   └── gsc/              # GSC SEOProvider
│       ├── clients/              # Client resolution + Client Brain retrieval
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
- Redis instance (BullMQ)
- S3-compatible object storage bucket
- Secrets manager (or equivalent env-injection mechanism per environment)
- Anthropic API access (Claude)
- Metricool account + API/MCP access for at least one pilot client
- GA4 property + Search Console property access for at least one pilot client
- (Optional, Phase 1) Canva Developer/MCP access
- CI runner (GitHub Actions, included with the repo)
- Error tracking (Sentry or equivalent) — can be deferred past Day 1

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
