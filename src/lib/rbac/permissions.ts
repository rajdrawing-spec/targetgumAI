/**
 * Canonical role/permission definitions. Single source of truth, imported by
 * both the app (src/lib/rbac/context.ts) and prisma/seed.ts, so the seeded
 * data and the code that interprets it never drift apart.
 *
 * This is a starter set (BRD-PRD Section 4) - expanded as each module lands
 * (e.g. tool-execution and budget-change permissions arrive with the Tool
 * Registry in Day 5).
 */

export const SYSTEM_ROLE_KEYS = [
  'super_admin',
  'account_manager',
  'marketing_employee',
  'client_user',
] as const

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number]

export const SYSTEM_ROLES: ReadonlyArray<{ key: SystemRoleKey; name: string }> = [
  { key: 'super_admin', name: 'Super Admin' },
  { key: 'account_manager', name: 'Account Manager' },
  { key: 'marketing_employee', name: 'Marketing Employee' },
  { key: 'client_user', name: 'Client User' },
]

export const PERMISSIONS = [
  'organizations.manage',
  'users.manage',
  'clients.manage',
  'clients.read',
  'integrations.manage',
  'approvals.approve',
  'approvals.request',
  'tasks.create',
  'reports.read',
  'audit.read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_PERMISSIONS: Record<SystemRoleKey, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  account_manager: ['clients.read', 'approvals.approve', 'approvals.request', 'tasks.create', 'reports.read'],
  marketing_employee: ['clients.read', 'approvals.request', 'tasks.create', 'reports.read'],
  // Client User (BRD Section 4.4) can view/approve/give feedback but not
  // create internal tasks - that's staff-only (Section 4.2/4.3).
  client_user: ['clients.read', 'reports.read'],
}

/**
 * Roles whose client access is limited to their explicit ClientAssignment
 * rows, rather than every client in the organization. super_admin is
 * intentionally absent here (org-wide access, BRD Section 4.1); client_user
 * is handled separately (access via ClientUser rows, not ClientAssignment).
 */
export const SCOPED_CLIENT_ACCESS_ROLES: readonly SystemRoleKey[] = [
  'account_manager',
  'marketing_employee',
]
