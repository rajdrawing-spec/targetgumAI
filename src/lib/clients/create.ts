import { db } from '@/lib/db/client'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Client creation (BRD-PRD Section 4.1 - "Manage clients" is a Super Admin
 * capability, gated by `clients.manage`; Account Manager's "manage
 * assigned clients" (4.2) is about clients they're already assigned to,
 * not creating new ones). Missing until Day 15 - every client in this
 * codebase up to that point came from `prisma/seed.ts` or test factories,
 * not a real code path, which is a real gap against the MVP Exit
 * Criteria's "Real client can be created" (BRD Section 84).
 */

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'client'
  )
}

export async function createClient(ctx: AuthContext, input: { name: string; slug?: string }) {
  assertPermission(ctx, 'clients.manage')
  const name = input.name.trim()
  if (!name) throw new Error('Client name is required.')

  const baseSlug = slugify(input.slug?.trim() || name)
  let slug = baseSlug
  let suffix = 1
  // Slugs are unique per organization (@@unique([organizationId, slug])) -
  // append a numeric suffix on collision rather than failing outright,
  // since the UI offers no slug-editing affordance yet.
  while (
    await db.client.findUnique({ where: { organizationId_slug: { organizationId: ctx.organizationId, slug } } })
  ) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const client = await db.client.create({
    data: { organizationId: ctx.organizationId, name, slug, createdBy: ctx.userId },
  })
  await db.clientPolicy.create({ data: { clientId: client.id } })
  return client
}
