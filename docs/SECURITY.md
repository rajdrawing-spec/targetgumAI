# Security — TargetGum AI Marketing OS

This document is the living security model. Any security-relevant deviation from
it must be recorded here (BRD-PRD Section 125).

## Invariants (never violate)

1. **Tenant isolation is server-side, always.** Every client-owned query is
   scoped by `organization_id` + `client_id` resolved from the authenticated
   session — never from a client-supplied parameter alone. The frontend is
   never trusted to enforce isolation (BRD Section 5, 103).
2. **Authorization precedes tool execution**, every time:
   `Is user allowed? → Is agent allowed? → Is tool allowed? → Is client
   allowed? → Is action allowed? → Is risk level acceptable? → Is approval
   required?` Any failed check = DENY (BRD Section 31).
3. **Claude never decides its own access.** A model output referencing
   "Client B" does not authorize access to Client B — the TargetGum server
   authorizes the client first, independent of what the model said (BRD
   Section 12).
4. **Secrets never enter prompts, logs, or client-visible output.** API keys,
   OAuth refresh tokens, passwords, client secrets, DB credentials, and
   encryption keys are excluded by construction — the AI Gateway's context
   assembly step has no code path that can reference a credential field
   (BRD Section 30, 73).
5. **External content is data, not instructions.** Retrieved social content,
   web pages, and tool outputs cannot grant permissions, remove approval
   requirements, or override policy, regardless of what text they contain
   (BRD Section 79). Prompts are constructed so retrieved content is clearly
   delimited and never concatenated into the system/instruction portion.
6. **No fabricated data.** If a provider call fails, the system reports
   "integration unavailable" with the last successful sync timestamp —
   never a guessed or interpolated value (BRD Section 56).
7. **Idempotent writes.** Every external write operation carries an
   idempotency key (`workflow_run_id` + `step_id` + `provider` + `action`);
   a repeated execution request for an already-succeeded action is a no-op
   (BRD Section 57).
8. **Audit is append-only.** No update/delete path exists for `audit_events`
   from application code or ordinary user roles (BRD Section 28).

**Unattended (scheduled) execution is not an exception to any of the
above** (Phase 2, BRD Section 65's weekly automation,
`src/lib/queue/`). A cron-triggered job resolves a real `AuthContext` for
the client's own assigned staff (`resolveAutomationActor`,
`src/lib/queue/resolve-actor.ts`) and calls the same permission/tenant-
scoped workflow function a human triggers by clicking a button - invariant
2's chain runs in full, every time, whether the caller is a browser
request or a worker process. A client with no eligible staff assigned is
skipped (a `DENIED` audit event) rather than run under a fabricated
"system" identity - see `docs/DECISIONS.md` for the full design.

## Credential Handling

- OAuth refresh tokens and provider API secrets are stored in
  `integration_connections`, envelope-encrypted at rest using a key managed
  outside the database (KMS-backed in production; a local dev key in
  `.env.local`, never committed).
- Claude receives instructions like *"use the Metricool tool for Client A"* —
  never the credential itself. The backend resolves which stored credential a
  tool call is allowed to use (BRD Section 30).

## Approval / Risk Model

Every action has a risk classification — LOW (auto), MEDIUM (configurable),
HIGH (approval required by default), CRITICAL (approval always required, no
override) — per BRD Section 21. Client-level policy (`client_policies`) can
tighten defaults but never loosen CRITICAL.

## Required Security Test Coverage (BRD-PRD Section 78, 80)

Before a feature touching auth, tenant data, tool execution, or approvals is
considered done, the security suite (`tests/security/`) must cover the
relevant adversarial scenarios. **All ten now have dedicated automated
coverage (Day 12, `docs/MVP-CHECKLIST.md`)**:

1. User assigned to Client A requests Client B → must be denied.
   `tests/security/tenant-isolation.test.ts`
2. Agent attempts to call a tool outside its allowlist → denied.
   `tests/security/tool-authorization.test.ts`,
   `tests/security/privilege-escalation.test.ts`
3. Client A data must never appear in a Client B AI context.
   `tests/security/adversarial-brd-section-80.test.ts`
4. Prompt injection attempting to exfiltrate credentials → must fail; secrets
   are structurally unreachable from prompt-construction code.
   `tests/security/adversarial-brd-section-80.test.ts`
5. Unauthorized budget/campaign change attempt → denied, no partial execution.
   `tests/security/adversarial-brd-section-80.test.ts`
6. Approval token replay → rejected (idempotency + single-use).
   `tests/security/approval-engine.test.ts` (PENDING/REJECTED) +
   `tests/security/adversarial-brd-section-80.test.ts` (already-EXECUTED replay)
7. Duplicate campaign/post creation from a retried request → prevented by
   idempotency key. `tests/integration/tool-registry.test.ts`
8. OAuth credential belonging to another client used for a call → denied.
   `tests/security/adversarial-brd-section-80.test.ts`
9. Deleted/deactivated user's session or API token → denied.
   `tests/security/deleted-user.test.ts`
10. Tool returns content containing embedded instructions → treated as inert
    data, never executed as a command.
    `tests/security/adversarial-brd-section-80.test.ts`

All scenarios must fail safely (deny + audit event), never fail open — verified
by test, not just by code inspection.

## Secure Baseline (implemented)

- Secure HTTP headers set in `next.config.mjs` (X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy) — expanded with a
  strict CSP once auth/asset domains are finalized.
- `.env*` files are gitignored; `.env.example` documents required keys with
  no real values.
- CI runs lint + typecheck + unit + integration + security tests + build on
  every PR (`.github/workflows/ci.yml`).
- **Authentication**: Auth.js v5, passwords hashed with bcryptjs (never
  stored/logged in plaintext), TOTP MFA available per-user
  (`src/lib/auth/mfa.ts`), sign-in errors are deliberately generic
  ("incorrect email or password", never "no such user").
- **Secrets at rest**: MFA secrets and (once Integrations lands) OAuth
  refresh tokens are envelope-encrypted with AES-256-GCM
  (`src/lib/crypto/envelope.ts`) before ever reaching the database — see the
  round-trip and tamper-detection tests in `tests/unit/envelope.test.ts`.
- **Authorization**: every client-scoped read/write goes through
  `resolveAuthContext` → `assertPermission`/`assertClientAccess`
  (`src/lib/rbac/`) or the `src/lib/db/tenant.ts` helpers built on them.
  Verified both by the automated security suite (`tests/security/`, 13
  tests) and by a live manual run: an unauthenticated request to `/dashboard`
  redirects to `/sign-in`; a marketing_employee's dashboard shows only the
  one client they're assigned to, never the org's other client.
- **Public routes** (2026-09-24): `/` (signed-out landing) and `/start/**`
  (try-it) are intentionally reachable without a session. They hold only
  static lesson content and keep progress in the visitor's own
  localStorage; nothing reachable from them imports the database, auth,
  RBAC, AI, integrations or tools, or declares a server action -
  enforced by `tests/security/public-tryit-isolation.test.ts`. Any new
  public page must stay inside that test's entry points or add itself.
- **Route protection**: page-level `redirect()` guards (see
  `src/app/dashboard/page.tsx`), not Next.js middleware — see
  `docs/DECISIONS.md` for why middleware was deliberately skipped for now.

## Still to design (tracked in `docs/MVP-CHECKLIST.md`)

- Rate limiting / API abuse protection on the credentials sign-in endpoint.
- CSRF protection for any form-based mutation beyond Auth.js's own routes
  (which handle their own CSRF token already, per the live smoke test).
- Recovery-code persistence + UI for MFA (generation exists; storage/
  verification against a "used" state doesn't yet).
- A real sign-up/invitation flow — today, users only exist via
  `prisma/seed.ts` (dev-only) or manual DB inserts.
- Dependency/secret/vulnerability scanning in CI (adding `npm audit` /
  GitHub secret scanning / Dependabot — proposed for the first PR after
  foundation review, not yet added to avoid noise before the app exists).
- Encryption-at-rest configuration for the chosen managed Postgres provider
  (depends on final Neon vs. Supabase pick — see `docs/ARCHITECTURE.md`).
- DB-level `REVOKE UPDATE, DELETE` on `audit_events` for the app's DB role
  (pending how that role is provisioned on the chosen hosting platform).
