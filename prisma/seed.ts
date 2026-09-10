/**
 * Dev-only seed script. Creates a sample organization, the four system
 * roles (BRD-PRD Section 4), a starter permission set, and one sample
 * client with default policy - enough to exercise auth/RBAC work in Day 3
 * without hand-crafting rows in psql.
 *
 * Never run against staging/production data. Idempotent (safe to re-run).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SYSTEM_ROLES = [
  { key: 'super_admin', name: 'Super Admin' },
  { key: 'account_manager', name: 'Account Manager' },
  { key: 'marketing_employee', name: 'Marketing Employee' },
  { key: 'client_user', name: 'Client User' },
] as const

// Starter permission set. Expanded as each module lands - this is not the
// final authorization surface, just enough to unblock RBAC scaffolding.
const PERMISSIONS = [
  'organizations.manage',
  'users.manage',
  'clients.manage',
  'clients.read',
  'integrations.manage',
  'approvals.approve',
  'approvals.request',
  'reports.read',
  'audit.read',
] as const

const ROLE_PERMISSIONS: Record<(typeof SYSTEM_ROLES)[number]['key'], readonly string[]> = {
  super_admin: PERMISSIONS,
  account_manager: ['clients.read', 'approvals.approve', 'approvals.request', 'reports.read'],
  marketing_employee: ['clients.read', 'approvals.request', 'reports.read'],
  client_user: ['clients.read', 'reports.read'],
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'targetgum' },
    update: {},
    create: {
      name: 'TargetGum Digital Marketing',
      slug: 'targetgum',
    },
  })

  const permissionRecords = await Promise.all(
    PERMISSIONS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      }),
    ),
  )
  const permissionByKey = new Map(permissionRecords.map((p) => [p.key, p]))

  for (const { key, name } of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      update: { name },
      create: { organizationId: org.id, key, name, isSystem: true },
    })

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

  const client = await prisma.client.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'client-a' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Client A (pilot)',
      slug: 'client-a',
      createdBy: 'seed-script',
    },
  })

  await prisma.clientPolicy.upsert({
    where: { clientId: client.id },
    update: {},
    create: { clientId: client.id },
  })

  console.warn(`Seeded organization "${org.name}" with client "${client.name}".`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
