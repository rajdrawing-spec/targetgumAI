# db

- `client.ts` — the Prisma client singleton (import `db` from here, never
  `new PrismaClient()` directly).
- `tenant.ts` — `getAuthorizedClient(ctx, clientId)` and `scopedClientWhere(ctx)`,
  built on `src/lib/rbac/guards.ts`. Prefer these over a bare `db.client.findUnique`/
  `db.<model>.findMany` anywhere a clientId comes from a request.

All client-owned queries MUST be scoped by organizationId/clientId — never trust the
caller. See docs/SECURITY.md.
