import { z } from 'zod'
import { db } from '@/lib/db/client'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { ForbiddenError } from '@/lib/rbac/errors'
import { assertPermission } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

/** Client contacts CRUD - `clients.read` to list, `clients.edit` to change, always on an authorized client. */

export const clientContactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(200).optional().or(z.literal('')).transform((v) => v || null),
  phone: z.string().trim().max(40).optional().or(z.literal('')).transform((v) => v || null),
  designation: z.string().trim().max(120).optional().or(z.literal('')).transform((v) => v || null),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => v || null),
})

export type ClientContactInput = z.input<typeof clientContactSchema>

export async function listClientContacts(ctx: AuthContext, clientId: string) {
  assertPermission(ctx, 'clients.read')
  await getAuthorizedClient(ctx, clientId)
  return db.clientContact.findMany({ where: { clientId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] })
}

export async function addClientContact(ctx: AuthContext, clientId: string, input: ClientContactInput) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  const data = clientContactSchema.parse(input)
  return db.$transaction(async (tx) => {
    if (data.isPrimary) await tx.clientContact.updateMany({ where: { clientId, isPrimary: true }, data: { isPrimary: false } })
    return tx.clientContact.create({ data: { clientId, createdBy: ctx.userId, ...data } })
  })
}

export async function updateClientContact(ctx: AuthContext, clientId: string, contactId: string, input: ClientContactInput) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  const data = clientContactSchema.parse(input)
  return db.$transaction(async (tx) => {
    const existing = await tx.clientContact.findUnique({ where: { id: contactId } })
    if (!existing || existing.clientId !== clientId) throw new ForbiddenError('Not authorized for this contact.')
    if (data.isPrimary) await tx.clientContact.updateMany({ where: { clientId, isPrimary: true, NOT: { id: contactId } }, data: { isPrimary: false } })
    return tx.clientContact.update({ where: { id: contactId }, data })
  })
}

export async function deleteClientContact(ctx: AuthContext, clientId: string, contactId: string) {
  assertPermission(ctx, 'clients.edit')
  await getAuthorizedClient(ctx, clientId)
  const existing = await db.clientContact.findUnique({ where: { id: contactId } })
  if (!existing || existing.clientId !== clientId) throw new ForbiddenError('Not authorized for this contact.')
  await db.clientContact.delete({ where: { id: contactId } })
  return { id: contactId }
}
