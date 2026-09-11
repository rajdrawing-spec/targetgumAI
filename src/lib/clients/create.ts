import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db/client'
import { recordAuditEvent } from '@/lib/audit/record'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { BRAIN_SECTION_SCHEMAS } from './brain-schemas'
import { clientContactSchema, type ClientContactInput } from './contacts'
import { clientProfileSchema, type ClientProfileInput } from './profile'

/**
 * Client creation (BRD-PRD Section 4.1 - "Manage clients" is a Super Admin
 * capability, gated by `clients.manage`; Account Manager's "manage
 * assigned clients" (4.2) is about clients they're already assigned to,
 * not creating new ones).
 *
 * Accepts the full sectioned onboarding payload (profile, contacts, Client
 * Brain sections, competitors, policy) and writes it in one transaction,
 * so a half-created client never exists. Only `name` is required - every
 * other section is optional and can be filled in later from the client's
 * workspace.
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

export interface CreateClientInput extends ClientProfileInput {
  slug?: string
  contacts?: ClientContactInput[]
  brain?: Partial<Record<'business' | 'audience' | 'brand' | 'marketing', unknown>>
  competitors?: Array<{ name: string; url?: string; positioning?: string; observations?: string }>
  policy?: Partial<{
    maxDailyAdBudget: number | null
    maxBudgetChangePercent: number | null
    autoPublishSocial: boolean
    autoChangeAds: boolean
    requireApprovalForCampaignLaunch: boolean
  }>
  internalNotes?: string
}

export async function createClient(ctx: AuthContext, input: CreateClientInput) {
  assertPermission(ctx, 'clients.manage')
  const profile = clientProfileSchema.parse(input)
  const name = profile.name
  if (!name) throw new Error('Client name is required.')

  if (profile.accountManagerId) {
    const member = await db.organizationUser.findUnique({ where: { id: profile.accountManagerId }, select: { organizationId: true, status: true } })
    if (!member || member.organizationId !== ctx.organizationId || member.status !== 'ACTIVE') {
      throw new Error('That account manager is not a member of this organization.')
    }
  }

  // Names are unique per organization (case-insensitive). Before this
  // check, submitting the same name twice quietly produced "lho",
  // "lho-2", "lho-3" - three indistinguishable cards (docs/UX-ASSESSMENT.md).
  const existing = await db.client.findFirst({
    where: { organizationId: ctx.organizationId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (existing) throw new Error(`A client named "${existing.name}" already exists.`)

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

  const contacts = (input.contacts ?? []).filter((c) => c.name?.trim()).map((c) => clientContactSchema.parse(c))
  const brain: Record<string, unknown> = {}
  for (const [section, schema] of Object.entries(BRAIN_SECTION_SCHEMAS)) {
    const value = input.brain?.[section as keyof typeof BRAIN_SECTION_SCHEMAS]
    if (value && typeof value === 'object' && Object.keys(value).length > 0) brain[section] = schema.parse(value)
  }
  const competitors = (input.competitors ?? []).filter((c) => c.name?.trim())

  const client = await db.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        slug,
        legalName: profile.legalName,
        website: profile.website,
        industry: profile.industry,
        country: profile.country,
        city: profile.city,
        timezone: profile.timezone,
        description: profile.description,
        status: profile.status ?? 'ACTIVE',
        automationLevel: profile.automationLevel ?? 'MANUAL',
        accountManagerId: profile.accountManagerId,
        monthlyBudget: profile.monthlyBudget,
        tags: profile.tags ?? [],
        createdBy: ctx.userId,
      },
    })
    await tx.clientPolicy.create({
      data: {
        clientId: created.id,
        ...(input.policy?.maxDailyAdBudget != null && { maxDailyAdBudget: input.policy.maxDailyAdBudget }),
        ...(input.policy?.maxBudgetChangePercent != null && { maxBudgetChangePercent: input.policy.maxBudgetChangePercent }),
        ...(input.policy?.autoPublishSocial != null && { autoPublishSocial: input.policy.autoPublishSocial }),
        ...(input.policy?.autoChangeAds != null && { autoChangeAds: input.policy.autoChangeAds }),
        ...(input.policy?.requireApprovalForCampaignLaunch != null && {
          requireApprovalForCampaignLaunch: input.policy.requireApprovalForCampaignLaunch,
        }),
      },
    })
    if (contacts.length > 0) {
      let primarySeen = false
      await tx.clientContact.createMany({
        data: contacts.map((c) => {
          const isPrimary = c.isPrimary && !primarySeen
          if (isPrimary) primarySeen = true
          return { clientId: created.id, createdBy: ctx.userId, ...c, isPrimary }
        }),
      })
    }
    if (Object.keys(brain).length > 0) {
      await tx.clientBrain.create({ data: { ...(brain as Prisma.ClientBrainUncheckedCreateInput), clientId: created.id } })
    }
    if (competitors.length > 0) {
      await tx.clientCompetitor.createMany({ data: competitors.map((c) => ({ clientId: created.id, ...c })) })
    }
    if (input.internalNotes?.trim()) {
      await tx.clientFeedback.create({
        data: { clientId: created.id, createdBy: ctx.userId, category: 'GENERAL_NOTE', source: 'ACCOUNT_MANAGER', content: input.internalNotes.trim() },
      })
    }
    return created
  })

  await recordAuditEvent({ organizationId: ctx.organizationId, clientId: client.id, userId: ctx.userId, action: 'client.create', inputSummary: { name, slug }, result: 'SUCCESS' })
  return client
}
