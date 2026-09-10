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
relevant adversarial scenarios:

1. User assigned to Client A requests Client B → must be denied.
2. Agent attempts to call a tool outside its allowlist → denied.
3. Client A data must never appear in a Client B AI context.
4. Prompt injection attempting to exfiltrate credentials → must fail; secrets
   are structurally unreachable from prompt-construction code.
5. Unauthorized budget/campaign change attempt → denied, no partial execution.
6. Approval token replay → rejected (idempotency + single-use).
7. Duplicate campaign/post creation from a retried request → prevented by
   idempotency key.
8. OAuth credential belonging to another client used for a call → denied.
9. Deleted/deactivated user's session or API token → denied.
10. Tool returns content containing embedded instructions → treated as inert
    data, never executed as a command.

All scenarios must fail safely (deny + audit event), never fail open.

## Secure Baseline (already in the scaffold)

- Secure HTTP headers set in `next.config.mjs` (X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy) — expanded with a
  strict CSP once auth/asset domains are finalized.
- `.env*` files are gitignored; `.env.example` documents required keys with
  no real values.
- CI runs lint + typecheck + unit + integration + security tests + build on
  every PR (`.github/workflows/ci.yml`).

## Still to design (tracked in `docs/MVP-CHECKLIST.md`)

- Rate limiting / API abuse protection (Day 3+).
- CSRF protection for form-based mutations (Day 3, alongside auth).
- Dependency/secret/vulnerability scanning in CI (adding `npm audit` /
  GitHub secret scanning / Dependabot — proposed for the first PR after
  foundation review, not yet added to avoid noise before the app exists).
- Encryption-at-rest configuration for the chosen managed Postgres provider
  (depends on hosting decision — see open question in
  `docs/ARCHITECTURE.md`).
