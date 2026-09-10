import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { recordAuditEvent, listAuditEvents } from '@/lib/audit/record'
import { resolveAuthContext } from '@/lib/rbac/context'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  cleanupOrg,
  createSystemRoles,
  createTestClient,
  createTestOrg,
  createTestUser,
  testDb,
} from '../helpers/factory'

describe('audit log read access (BRD-PRD Section 4.1: viewing audit logs is Super Admin only by default)', () => {
  let orgId: string
  let clientId: string
  let superAdminId: string
  let employeeId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const roles = await createSystemRoles(orgId)
    const client = await createTestClient(orgId, 'Audit Test Client')
    clientId = client.id

    const superAdmin = await createTestUser()
    superAdminId = superAdmin.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: superAdminId, roleId: roles.get('super_admin')!.id },
    })

    const employee = await createTestUser()
    employeeId = employee.id
    await testDb.organizationUser.create({
      data: { organizationId: orgId, userId: employeeId, roleId: roles.get('marketing_employee')!.id },
    })

    await recordAuditEvent({
      organizationId: orgId,
      clientId,
      action: 'test.seed_event',
      result: 'SUCCESS',
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [superAdminId, employeeId])
  })

  it('denies audit log access to a role without audit.read', async () => {
    const ctx = await resolveAuthContext(testDb, employeeId, orgId)
    await expect(listAuditEvents(ctx!)).rejects.toThrow(ForbiddenError)
  })

  it('allows audit log access for super_admin and returns the recorded event', async () => {
    const ctx = await resolveAuthContext(testDb, superAdminId, orgId)
    const events = await listAuditEvents(ctx!, { clientId })
    expect(events.some((e) => e.action === 'test.seed_event')).toBe(true)
  })
})
