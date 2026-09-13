import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../../src/lib/auth/password'
import { ROLE_PERMISSIONS, SYSTEM_ROLES, type SystemRoleKey } from '../../src/lib/rbac/permissions'

/**
 * Test data factory for integration/security tests. Every helper here
 * creates real rows in whatever DATABASE_URL points at (tests/setup-env.ts
 * loads .env.local locally; CI sets it directly) - always via unique
 * slugs/emails so parallel test files never collide, and always cleaned up
 * with `cleanupOrg` in an `afterAll`.
 */

export const testDb = new PrismaClient()

let counter = 0
function unique(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createTestOrg() {
  return testDb.organization.create({
    data: { name: unique('Test Org'), slug: unique('test-org') },
  })
}

/** Seeds the three system roles + starter permission set for one org. */
export async function createSystemRoles(
  organizationId: string,
): Promise<Map<SystemRoleKey, { id: string }>> {
  const permissionKeys = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()))
  const permissions = await Promise.all(
    permissionKeys.map((key) =>
      testDb.permission.upsert({ where: { key }, update: {}, create: { key } }),
    ),
  )
  const permissionByKey = new Map(permissions.map((p) => [p.key, p]))

  const roles = new Map<SystemRoleKey, { id: string }>()
  for (const { key, name } of SYSTEM_ROLES) {
    const role = await testDb.role.create({ data: { organizationId, key, name, isSystem: true } })
    roles.set(key, role)
    for (const permissionKey of ROLE_PERMISSIONS[key]) {
      const permission = permissionByKey.get(permissionKey)
      if (!permission) continue
      await testDb.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      })
    }
  }
  return roles
}

export async function createTestUser(overrides: { status?: 'ACTIVE' | 'DISABLED' } = {}) {
  return testDb.user.create({
    data: {
      email: `${unique('user')}@example.test`,
      passwordHash: await hashPassword('irrelevant-for-these-tests'),
      status: overrides.status ?? 'ACTIVE',
    },
  })
}

export async function createTestClient(organizationId: string, name?: string) {
  const client = await testDb.client.create({
    data: { organizationId, name: name ?? unique('Client'), slug: unique('client'), createdBy: 'test' },
  })
  await testDb.clientPolicy.create({ data: { clientId: client.id } })
  return client
}

/** Deletes an org (cascades to almost everything created under it) plus any stray users. */
export async function cleanupOrg(organizationId: string, userIds: string[] = []): Promise<void> {
  await testDb.organization.delete({ where: { id: organizationId } }).catch(() => undefined)
  if (userIds.length > 0) {
    await testDb.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined)
  }
}
