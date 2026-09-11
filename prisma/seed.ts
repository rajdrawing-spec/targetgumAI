/**
 * Dev-only seed script. Creates a sample organization, the four system
 * roles (BRD-PRD Section 4), a starter permission set, one sample client,
 * and one dev-login user per role - enough to exercise auth/RBAC manually
 * or in tests without hand-crafting rows in psql.
 *
 * Never run against staging/production data. Idempotent (safe to re-run).
 * Seeded passwords are dev-only and printed to the console, never meant to
 * be secret - do not reuse this pattern past local development.
 */
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

  const client = await prisma.client.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'client-a' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Client A (pilot)',
      slug: 'client-a',
      industry: 'E-commerce',
      website: 'https://client-a-pilot.example.com',
      country: 'India',
      city: 'Chennai',
      timezone: 'Asia/Kolkata',
      description: 'Pilot client used to exercise every workflow end-to-end - see docs/PILOT-RUNBOOK.md.',
      createdBy: 'seed-script',
    },
  })

  await prisma.clientPolicy.upsert({
    where: { clientId: client.id },
    update: {},
    create: { clientId: client.id },
  })

  // A second client, unassigned to anyone below, so cross-client-access
  // tests have somewhere to correctly fail against.
  const otherClient = await prisma.client.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'client-b' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Client B (not assigned to seeded staff)',
      slug: 'client-b',
      industry: 'Education',
      website: 'https://client-b.example.com',
      country: 'India',
      city: 'Bengaluru',
      createdBy: 'seed-script',
    },
  })
  await prisma.clientPolicy.upsert({
    where: { clientId: otherClient.id },
    update: {},
    create: { clientId: otherClient.id },
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
    create: { email: 'employee@targetgum.dev', name: 'Dev Marketing Employee', passwordHash },
  })
  const employeeMembership = await prisma.organizationUser.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: employeeUser.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: employeeUser.id,
      roleId: roleByKey.get('marketing_employee')!.id,
    },
  })
  // Assigned to Client A only - used to prove Client B access is denied.
  await prisma.clientAssignment.upsert({
    where: {
      clientId_organizationUserId: { clientId: client.id, organizationUserId: employeeMembership.id },
    },
    update: {},
    create: { clientId: client.id, organizationUserId: employeeMembership.id },
  })

  const clientPortalUser = await prisma.user.upsert({
    where: { email: 'client-a-user@targetgum.dev' },
    update: {},
    create: { email: 'client-a-user@targetgum.dev', name: 'Client A Portal User', passwordHash },
  })
  await prisma.clientUser.upsert({
    where: { clientId_userId: { clientId: client.id, userId: clientPortalUser.id } },
    update: {},
    create: { clientId: client.id, userId: clientPortalUser.id },
  })

  console.warn(`Seeded organization "${org.name}" with clients "${client.name}" and "${otherClient.name}".`)
  console.warn(`Dev users (password for all: ${DEV_PASSWORD}):`)
  console.warn(`  super-admin@targetgum.dev    - super_admin, all clients in org`)
  console.warn(`  employee@targetgum.dev       - marketing_employee, assigned to Client A only`)
  console.warn(`  client-a-user@targetgum.dev  - client_user, Client A portal only`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
