import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasGoogleSignInAccess } from '@/lib/auth/google-access'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

/**
 * "Continue with Google" (docs/DECISIONS.md, 2026-09-13) must never be a
 * self-service sign-up path - the only way anyone gets access to this app
 * is a Super Admin's email invitation (src/lib/users/invitations.ts).
 * `hasGoogleSignInAccess` is the one check that makes it safe to let the
 * `signIn` callback (src/lib/auth/config.ts) attach a Google identity to
 * an existing User row (`allowDangerousEmailAccountLinking`) instead of
 * refusing outright - these pin every case it has to get right.
 */
describe('security: Google sign-in never grants access on its own', () => {
  let orgId: string
  let roles: Map<string, { id: string }>
  const userIds: string[] = []

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    roles = await createSystemRoles(orgId)
  })

  afterAll(async () => {
    await cleanupOrg(orgId, userIds)
  })

  it('denies an email with no User row at all (a stranger, never invited)', async () => {
    await expect(hasGoogleSignInAccess('never-invited@example.test')).resolves.toBe(false)
  })

  it('denies an email whose User row exists but has no membership (an orphaned/incomplete row)', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    await expect(hasGoogleSignInAccess(user.email)).resolves.toBe(false)
  })

  it('denies a DISABLED user even with an active staff membership', async () => {
    const user = await createTestUser({ status: 'DISABLED' })
    userIds.push(user.id)
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: user.id, roleId: roles.get('employee')!.id },
    })
    await expect(hasGoogleSignInAccess(user.email)).resolves.toBe(false)
  })

  it('denies an ACTIVE user whose staff membership itself is DISABLED', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: user.id, roleId: roles.get('employee')!.id, status: 'DISABLED' },
    })
    await expect(hasGoogleSignInAccess(user.email)).resolves.toBe(false)
  })

  it('allows an ACTIVE user with an ACTIVE staff (super_admin) membership', async () => {
    const user = await createTestUser()
    userIds.push(user.id)
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: user.id, roleId: roles.get('super_admin')!.id },
    })
    await expect(hasGoogleSignInAccess(user.email)).resolves.toBe(true)
  })

  it('allows an ACTIVE user with only client-portal access (a ClientUser row, no staff membership)', async () => {
    const client = await createTestClient(orgId)
    const user = await createTestUser()
    userIds.push(user.id)
    await testDb.clientUser.create({ data: { clientId: client.id, userId: user.id } })
    await expect(hasGoogleSignInAccess(user.email)).resolves.toBe(true)
  })
})
