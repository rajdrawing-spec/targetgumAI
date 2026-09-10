import type { BrandAssetType, ClientFeedbackCategory, ClientFeedbackSource } from '@prisma/client'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'
import { BRAIN_SECTION_SCHEMAS, type BrainSectionKey } from './brain-schemas'

/**
 * Client Brain CRUD (BRD-PRD Section 6). Every function here is tenant- and
 * permission-checked (`clients.read` for reads, `clients.edit` for writes
 * to an already-accessible client's Brain/Policy/brand assets/competitors
 * - see `docs/DECISIONS.md` for why this is `.edit`, not `.manage`, and
 * `feedback.create` for `addClientFeedback`) via the same guards as
 * everything else - never a special case.
 */

// --- Narrative sections (business/audience/brand/marketing) ---

export async function getClientBrainSection(
  ctx: AuthContext,
  clientId: string,
  section: BrainSectionKey,
): Promise<unknown> {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  const brain = await db.clientBrain.findUnique({ where: { clientId } })
  return brain?.[section] ?? null
}

/** Fetches multiple sections in one query - what the Context Router uses instead of the whole brain. */
export async function getClientBrainSections(
  ctx: AuthContext,
  clientId: string,
  sections: BrainSectionKey[],
): Promise<Partial<Record<BrainSectionKey, unknown>>> {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  const brain = await db.clientBrain.findUnique({ where: { clientId } })
  const result: Partial<Record<BrainSectionKey, unknown>> = {}
  for (const section of sections) {
    if (brain?.[section] != null) result[section] = brain[section]
  }
  return result
}

/** Validates `data` against the section's schema (throws ZodError on failure) before writing. */
export async function updateClientBrainSection(
  ctx: AuthContext,
  clientId: string,
  section: BrainSectionKey,
  data: unknown,
) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  const parsed = BRAIN_SECTION_SCHEMAS[section].parse(data)
  return db.clientBrain.upsert({
    where: { clientId },
    update: { [section]: parsed },
    create: { clientId, [section]: parsed },
  })
}

// --- Brand assets ---

export async function listClientBrandAssets(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.clientBrandAsset.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } })
}

export async function addClientBrandAsset(
  ctx: AuthContext,
  clientId: string,
  input: { type: BrandAssetType; label: string; url: string; restricted?: boolean },
) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  return db.clientBrandAsset.create({ data: { clientId, createdBy: ctx.userId, ...input } })
}

// --- Competitors ---

export async function listClientCompetitors(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.clientCompetitor.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } })
}

export async function addClientCompetitor(
  ctx: AuthContext,
  clientId: string,
  input: { name: string; url?: string; positioning?: string; observations?: string },
) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  return db.clientCompetitor.create({ data: { clientId, ...input } })
}

// --- Policy (1:1 with client - created by default alongside the client, see prisma/seed.ts) ---

export async function getClientPolicy(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.clientPolicy.findUnique({ where: { clientId } })
}

export async function updateClientPolicy(
  ctx: AuthContext,
  clientId: string,
  input: Partial<{
    maxDailyAdBudget: number
    maxBudgetChangePercent: number
    autoPublishSocial: boolean
    autoChangeAds: boolean
    requireApprovalForCampaignLaunch: boolean
  }>,
) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  return db.clientPolicy.upsert({
    where: { clientId },
    update: input,
    create: { clientId, ...input },
  })
}

// --- Feedback ---

export async function listClientFeedback(ctx: AuthContext, clientId: string, limit = 20) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.clientFeedback.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: limit })
}

export async function addClientFeedback(
  ctx: AuthContext,
  clientId: string,
  input: { category: ClientFeedbackCategory; content: string; source: ClientFeedbackSource },
) {
  assertPermission(ctx, 'feedback.create')
  await getAuthorizedClient(ctx, clientId)
  return db.clientFeedback.create({ data: { clientId, createdBy: ctx.userId, ...input } })
}
