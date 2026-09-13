/**
 * Dev-only seed script. Creates a sample organization, the three system
 * roles (super_admin, employee, client - see src/lib/rbac/permissions.ts),
 * a starter permission set, one sample client, and one dev-login user per
 * role - enough to exercise auth/RBAC manually or in tests without
 * hand-crafting rows in psql.
 *
 * Never run against staging/production data. Idempotent (safe to re-run).
 * Seeded passwords are dev-only and printed to the console, never meant to
 * be secret - do not reuse this pattern past local development.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'
import { ROLE_PERMISSIONS, SYSTEM_ROLES, type SystemRoleKey } from '../src/lib/rbac/permissions'

const prisma = new PrismaClient()

const DEV_PASSWORD = 'DevPassword!23'

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'targetgum' },
    update: {},
    create: {
      name: 'TargetGum Digital Marketing',
      slug: 'targetgum',
    },
  })

  const permissionKeys = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()))
  const permissionRecords = await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      }),
    ),
  )
  const permissionByKey = new Map(permissionRecords.map((p) => [p.key, p]))

  const roleByKey = new Map<SystemRoleKey, { id: string }>()
  for (const { key, name } of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      update: { name },
      create: { organizationId: org.id, key, name, isSystem: true },
    })
    roleByKey.set(key, role)

    for (const permissionKey of ROLE_PERMISSIONS[key]) {
      const permission = permissionByKey.get(permissionKey)
      if (!permission) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      })
    }
  }

  // Ensure any past demo clients (Client A pilot, Client B) are purged
  await prisma.client.deleteMany({
    where: {
      organizationId: org.id,
      slug: { in: ['client-a', 'client-b'] },
    },
  })

  const passwordHash = await hashPassword(DEV_PASSWORD)

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'super-admin@targetgum.dev' },
    update: {},
    create: { email: 'super-admin@targetgum.dev', name: 'Dev Super Admin', passwordHash },
  })
  await prisma.organizationUser.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: superAdminUser.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: superAdminUser.id,
      roleId: roleByKey.get('super_admin')!.id,
    },
  })

  const employeeUser = await prisma.user.upsert({
    where: { email: 'employee@targetgum.dev' },
    update: {},
    create: { email: 'employee@targetgum.dev', name: 'Dev Employee', passwordHash },
  })
  await prisma.organizationUser.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: employeeUser.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: employeeUser.id,
      roleId: roleByKey.get('employee')!.id,
    },
  })

  // No seeded "client" (portal) user or demo clients (docs/DECISIONS.md,
  // 2026-09-13 "eliminate dummy data") - a client-role account only makes
  // sense tied to a real client, and this script deliberately seeds zero
  // of those. Create one for real via the Team page's invite flow
  // (`src/lib/users/invitations.ts`) once a real client exists.
  console.warn(`Seeded organization "${org.name}" with zero dummy clients.`)
  console.warn(`Dev users (password: ${DEV_PASSWORD}):`)
  console.warn(`  super-admin@targetgum.dev    - super_admin, full agency access`)
  console.warn(`  employee@targetgum.dev       - employee`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
