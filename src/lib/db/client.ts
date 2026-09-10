import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton. Import `db` from here everywhere - never
 * `new PrismaClient()` directly - so we don't exhaust connections across
 * Next.js hot reloads / serverless invocations.
 *
 * This file does NOT enforce tenant isolation by itself. Tenant-scoped
 * query helpers (organizationId/clientId filtering) belong in sibling
 * files in this directory - see docs/SECURITY.md. Call sites elsewhere in
 * the app should prefer those helpers over using `db` directly for any
 * client-owned model.
 */

declare global {
  var __prisma: PrismaClient | undefined
}

export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db
}
