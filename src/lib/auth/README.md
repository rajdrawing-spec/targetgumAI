# auth

Auth.js v5 configuration (`config.ts`, `index.ts`), password hashing (`password.ts`),
TOTP MFA (`mfa.ts`), and the per-request `AuthContext` resolver (`current-context.ts`).
See docs/ARCHITECTURE.md (Auth), docs/SECURITY.md, and docs/DECISIONS.md for the
session-strategy and MFA rationale.

RBAC's own role/permission/tenant-access logic lives in `src/lib/rbac/` (kept
framework-agnostic, no Auth.js/Next.js imports) - this directory is the Next.js/
Auth.js-specific glue on top of it.
