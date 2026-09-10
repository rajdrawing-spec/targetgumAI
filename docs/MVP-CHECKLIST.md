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
