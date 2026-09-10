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

### Day 3 — Authentication, authorization, tenant isolation, security tests

- [ ] Auth.js setup (credentials + magic link), session management
- [ ] TOTP MFA enrollment/verification
- [ ] RBAC resolution (org role + client-level permissions)
- [ ] Tenant-scoped query helpers in `src/lib/db/`
- [ ] Security tests: cross-client access, deleted-user access, privilege escalation

### Day 4 — Claude integration, AI Gateway, structured outputs, AI run tracking

- [ ] `src/lib/ai/` Claude client wrapper
- [ ] Prompt versioning (`prompts/`)
- [ ] Structured output validation (Zod schemas)
- [ ] `ai_runs` persistence

### Day 5 — Tool registry, permission system, audit events

- [ ] Tool Registry schema + implementation
- [ ] Per-agent tool allowlist enforcement
- [ ] Append-only `audit_events` writer

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
