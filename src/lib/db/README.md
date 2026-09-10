# db

`client.ts` — the Prisma client singleton (import `db` from here, never
`new PrismaClient()` directly).

Tenant-scoped query helpers land in Day 3 alongside auth/RBAC, once there's a
session/permission model to scope against. All client-owned queries MUST be
scoped by organizationId/clientId — never trust the caller. See docs/SECURITY.md.
