import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db/client'
import { listNotificationsForUser, markNotificationRead } from '@/lib/notifications/service'
import { ForbiddenError } from '@/lib/rbac/errors'
import { resolveAuthContext } from '@/lib/rbac/context'
import { cleanupOrg, createSystemRoles, createTestOrg, createTestUser, testDb } from '../helpers/factory'

/**
 * A notification's own row (`userId`) IS the authorization boundary - there
 * is no separate permission for "read notifications", so this is the one
 * place that boundary can silently break (docs/SECURITY.md invariant: never
 * trust a caller-supplied id alone). Covers same-org cross-user leakage
 * (the likelier real bug: two employees of the same agency) and, for
 * completeness, cross-org leakage too.
 */
describe('security: notifications are strictly per-user, never per-role or per-org alone', () => {
  let orgId: string
  let otherOrgId: string
  let userAId: string
  let userBId: string
  let crossOrgUserId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)

    const otherOrg = await createTestOrg()
    otherOrgId = otherOrg.id
    const otherRoles = await createSystemRoles(otherOrgId)

    const userA = await createTestUser()
    userAId = userA.id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: userAId, roleId: roles.get('super_admin')!.id } })

    const userB = await createTestUser()
    userBId = userB.id
    await testDb.organizationUser.create({ data: { organizationId: orgId, userId: userBId, roleId: roles.get('super_admin')!.id } })

    const crossOrgUser = await createTestUser()
    crossOrgUserId = crossOrgUser.id
    await testDb.organizationUser.create({
      data: { organizationId: otherOrgId, userId: crossOrgUserId, roleId: otherRoles.get('super_admin')!.id },
    })

    // One notification each, same org, same super_admin role - the case a
    // naive "any admin can read any admin notification" bug would pass.
    await db.notification.create({
      data: { organizationId: orgId, userId: userAId, channel: 'IN_APP', type: 'APPROVAL_REQUIRED', title: "User A's notification" },
    })
    await db.notification.create({
      data: { organizationId: orgId, userId: userBId, channel: 'IN_APP', type: 'APPROVAL_REQUIRED', title: "User B's notification" },
    })
  })

  afterAll(async () => {
    await db.notification.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } })
    await cleanupOrg(orgId, [userAId, userBId])
    await cleanupOrg(otherOrgId, [crossOrgUserId])
  })

  it('listNotificationsForUser never returns another user\'s notifications, even same org and same role', async () => {
    const ctxA = await resolveAuthContext(testDb, userAId, orgId)
    const listA = await listNotificationsForUser(ctxA!)
    expect(listA.map((n) => n.title)).toEqual(["User A's notification"])
    expect(listA.every((n) => n.userId === userAId)).toBe(true)

    const ctxB = await resolveAuthContext(testDb, userBId, orgId)
    const listB = await listNotificationsForUser(ctxB!)
    expect(listB.map((n) => n.title)).toEqual(["User B's notification"])
  })

  it('markNotificationRead throws ForbiddenError for another user\'s notification (same org, same role) and leaves it unread', async () => {
    const ctxB = await resolveAuthContext(testDb, userBId, orgId)
    const aNotification = await db.notification.findFirstOrThrow({ where: { userId: userAId } })

    await expect(markNotificationRead(ctxB!, aNotification.id)).rejects.toThrow(ForbiddenError)

    const stillUnread = await db.notification.findUniqueOrThrow({ where: { id: aNotification.id } })
    expect(stillUnread.readAt).toBeNull()
  })

  it('markNotificationRead throws ForbiddenError across organizations for the same notification id', async () => {
    const ctxCrossOrg = await resolveAuthContext(testDb, crossOrgUserId, otherOrgId)
    const aNotification = await db.notification.findFirstOrThrow({ where: { userId: userAId } })

    await expect(markNotificationRead(ctxCrossOrg!, aNotification.id)).rejects.toThrow(ForbiddenError)
  })

  it('markNotificationRead throws ForbiddenError for a nonexistent notification id, never a different error that would leak existence', async () => {
    const ctxA = await resolveAuthContext(testDb, userAId, orgId)
    await expect(markNotificationRead(ctxA!, 'does-not-exist')).rejects.toThrow(ForbiddenError)
  })
})
