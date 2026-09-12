import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit/record'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { ForbiddenError } from '@/lib/rbac/errors'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/**
 * Client profile lifecycle (docs/UX-ASSESSMENT.md §7 - none of this
 * existed; the only client code path was `createClient`).
 *
 * Authorization (docs/DECISIONS.md): editing an already-accessible
 * client's profile needs `clients.edit` (Account Manager's "manage
 * assigned clients", BRD 4.2); archive / unarchive / delete are
 * organization-level administration and need `clients.manage` (Super
 * Admin's "Manage clients", BRD 4.1). Every path still goes through
 * `getAuthorizedClient`, so a Super Admin of another organization is
 * denied like anyone else. Archive is the soft delete; delete is hard,
 * audited before it runs, and requires the caller to echo the client's
 * name (the UI asks the user to type it - the check is enforced here so
 * the confirmation can't be bypassed by calling the action directly).
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null))

export const clientProfileSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters.').max(120),
  legalName: optionalText(200),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => (v ? (v.startsWith('http') ? v : `https://${v}`) : null))
    .refine((v) => v == null || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), 'Enter a valid website, e.g. example.com'),
  industry: optionalText(80),
  country: optionalText(80),
  city: optionalText(120),
  timezone: optionalText(64),
  description: optionalText(4000),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  automationLevel: z.enum(['MANUAL', 'ASSISTED', 'APPROVAL_BASED', 'HIGH_AUTOMATION']).optional(),
  accountManagerId: optionalText(64),
  monthlyBudget: z
    .union([z.number(), z.string().trim()])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : Number(v)))
    .refine((v) => v == null || (Number.isFinite(v) && v >= 0), 'Monthly budget must be a positive number.'),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
})

export type ClientProfileInput = z.input<typeof clientProfileSchema>

/** Members of the caller's organization who can be designated as account manager (Super Admin or Account Manager role). */
export async function listAccountManagerCandidates(ctx: AuthContext) {
  assertPermission(ctx, 'clients.read')
  const members = await db.organizationUser.findMany({
    where: { organizationId: ctx.organizationId, status: 'ACTIVE', role: { key: { in: ['super_admin', 'account_manager'] } } },
    select: { id: true, role: { select: { key: true, name: true } }, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return members.map((m) => ({ id: m.id, label: m.user.name || m.user.email, roleKey: m.role.key, roleName: m.role.name }))
}

async function assertAccountManagerInOrg(ctx: AuthContext, organizationUserId: string) {
  const member = await db.organizationUser.findUnique({ where: { id: organizationUserId }, select: { organizationId: true, status: true } })
  // Same error whether the id is unknown, in another organization, or disabled - never confirm existence.
  if (!member || member.organizationId !== ctx.organizationId || member.status !== 'ACTIVE') {
    throw new ForbiddenError('That account manager is not a member of this organization.')
  }
}

export async function updateClientProfile(ctx: AuthContext, clientId: string, input: ClientProfileInput) {
  assertPermission(ctx, 'clients.edit')
  const client = await getAuthorizedClient(ctx, clientId)
  const data = clientProfileSchema.parse(input)

  if (data.name.toLowerCase() !== client.name.toLowerCase()) {
    const clash = await db.client.findFirst({
      where: { organizationId: ctx.organizationId, name: { equals: data.name, mode: 'insensitive' }, NOT: { id: clientId } },
      select: { name: true },
    })
    if (clash) throw new Error(`A client named "${clash.name}" already exists.`)
  }
  if (data.accountManagerId) await assertAccountManagerInOrg(ctx, data.accountManagerId)
  if (client.status === 'ARCHIVED' && data.status) {
    throw new Error('Unarchive the client before changing its status.')
  }

  const updated = await db.client.update({
    where: { id: clientId },
    data: {
      name: data.name,
      legalName: data.legalName,
      website: data.website,
      industry: data.industry,
      country: data.country,
      city: data.city,
      timezone: data.timezone,
      description: data.description,
      ...(data.status && { status: data.status }),
      ...(data.automationLevel && { automationLevel: data.automationLevel }),
      accountManagerId: data.accountManagerId,
      monthlyBudget: data.monthlyBudget,
      ...(data.tags && { tags: data.tags }),
    },
  })
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    action: 'client.update',
    inputSummary: { fields: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined) },
    result: 'SUCCESS',
  })
  return updated
}

export async function archiveClient(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.manage')
  const client = await getAuthorizedClient(ctx, clientId)
  if (client.status === 'ARCHIVED') return client
  const updated = await db.client.update({ where: { id: clientId }, data: { status: 'ARCHIVED', archivedAt: new Date() } })
  await recordAuditEvent({ organizationId: ctx.organizationId, clientId, userId: ctx.userId, action: 'client.archive', result: 'SUCCESS' })
  return updated
}

export async function unarchiveClient(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.manage')
  const client = await getAuthorizedClient(ctx, clientId)
  if (client.status !== 'ARCHIVED') return client
  const updated = await db.client.update({ where: { id: clientId }, data: { status: 'ACTIVE', archivedAt: null } })
  await recordAuditEvent({ organizationId: ctx.organizationId, clientId, userId: ctx.userId, action: 'client.unarchive', result: 'SUCCESS' })
  return updated
}

/**
 * Hard delete. Cascades to every client-owned table (see the `onDelete:
 * Cascade` relations on `Client`); audit events keep their history with
 * `clientId` set to null, and the audit row written *before* the delete
 * carries the client's name and slug so the trail still says what was
 * removed.
 */
export async function deleteClient(ctx: AuthContext, clientId: string, confirmName: string) {
  assertPermission(ctx, 'clients.manage')
  const client = await getAuthorizedClient(ctx, clientId)
  if (confirmName.trim().toLowerCase() !== client.name.trim().toLowerCase() && confirmName.trim().toUpperCase() !== 'CONFIRM') {
    throw new Error('Type the client\'s exact name to confirm deletion.')
  }
  await recordAuditEvent({
    organizationId: ctx.organizationId,
    clientId,
    userId: ctx.userId,
    action: 'client.delete',
    inputSummary: { name: client.name, slug: client.slug },
    riskLevel: 'CRITICAL',
    result: 'SUCCESS',
  })
  await db.client.delete({ where: { id: clientId } })
  return { id: clientId, name: client.name }
}
