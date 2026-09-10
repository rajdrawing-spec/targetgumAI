# rbac

Role-based access control, framework-agnostic (no Next.js/Auth.js imports - fully
unit/integration-testable on its own):

- `permissions.ts` — canonical role/permission definitions (also imported by
  `prisma/seed.ts`, so seeded data and app logic never drift apart)
- `types.ts` — the `AuthContext` shape
- `context.ts` — `resolveAuthContext`: DB → full authorization context
- `guards.ts` — `assertPermission`, `assertClientAccess`, `requireAuthContext`
- `errors.ts` — `AuthenticationError`, `ForbiddenError`

See docs/DATA-MODEL.md and Section 31 (Authorization Model) of docs/BRD-PRD.md.
`src/lib/auth/` is the Next.js/Auth.js-specific layer built on top of this.
