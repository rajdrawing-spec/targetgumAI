# db

Prisma client singleton and tenant-scoped query helpers. All client-owned queries MUST be
scoped by organization_id/client_id here — never trust the caller. See docs/SECURITY.md.
