/**
 * Canonical role/permission definitions. Single source of truth, imported by
 * both the app (src/lib/rbac/context.ts) and prisma/seed.ts, so the seeded
 * data and the code that interprets it never drift apart.
 *
 * Three system roles only (2026-09-13 role-model simplification - see
 * docs/DECISIONS.md; deviates from BRD-PRD Section 4's four-role list,
 * which is left as-is since it's the frozen source document): `super_admin`
 * (the one seeded root account per organization - not self-service, not
 * invitable by anyone else), and exactly two invitable roles a Super Admin
 * can hand out by email - `employee` (internal staff; merges the former
 * `account_manager` + `marketing_employee` distinction into one role, since
 * nothing in this app enforces that split as a security boundary - see
 * ROLE_PERMISSIONS below) and `client` (client-portal access, formerly
 * `client_user` - same semantics, renamed only). Custom/org-defined roles
 * are still a later extension point (Role.organizationId), not built yet.
 */

export const SYSTEM_ROLE_KEYS = ['super_admin', 'employee', 'client'] as const

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number]

/** The subset of SYSTEM_ROLE_KEYS a Super Admin can assign when inviting someone by email. Super Admin itself is never invited - see INVITABLE_ROLES's own doc comment. */
export const INVITABLE_ROLES: readonly SystemRoleKey[] = ['employee', 'client']

export const SYSTEM_ROLES: ReadonlyArray<{ key: SystemRoleKey; name: string }> = [
  { key: 'super_admin', name: 'Super Admin' },
  { key: 'employee', name: 'Employee' },
  { key: 'client', name: 'Client' },
]

export const PERMISSIONS = [
  'organizations.manage',
  'users.manage',
  'clients.manage',
  'clients.edit',
  'clients.read',
  'integrations.manage',
  'approvals.approve',
  'approvals.request',
  'tasks.create',
  'reports.read',
  'audit.read',
  'recommendations.review',
  'feedback.create',
  'analysis.trigger',
  'content.manage',
  'ads.manage',
  'creative.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * `clients.manage` vs. `clients.edit` (added when the Client Portal/Phase-2
 * permission audit found this conflated, see docs/DECISIONS.md): `.manage`
 * is org-wide client *administration* - create a brand-new client
 * (`src/lib/clients/create.ts`), Super Admin only per BRD Section 4.1's
 * unscoped "Manage clients". `.edit` is narrower - update an
 * *already-accessible* client's Brain/Policy/brand assets/competitors
 * (`src/lib/clients/brain.ts`) - matches assigned-client staff editing
 * clients already assigned to them (still enforced by `assertClientAccess`,
 * not by this permission alone), but not create new ones org-wide.
 *
 * `employee` (2026-09-13 role-model simplification, see docs/DECISIONS.md)
 * is the union of the former `account_manager` + `marketing_employee`
 * permission sets - in practice, exactly `account_manager`'s old list,
 * since `marketing_employee` was already a strict subset of it. Nothing in
 * this codebase enforced the two as separate security boundaries (both
 * were `SCOPED_CLIENT_ACCESS_ROLES`, both accessed clients the same way via
 * ClientAssignment); the only difference was permission breadth
 * (`clients.edit`, `approvals.approve`, `ads.manage`), which every employee
 * now has. If a narrower "can view but not manage ads/approvals" staff tier
 * is needed later, reintroduce it as a second invitable role rather than
 * re-splitting this one.
 *
 * `client` (renamed from `client_user`, same semantics, BRD Section 4.4):
 * "View own dashboard, View reports, Review recommendations, Approve
 * allowed actions, Provide feedback, View content/creative, Never access
 * another client." Deliberately narrower than staff: no `clients.edit`
 * (can't rewrite their own Brain/policy), no `analysis.trigger` (can't
 * spend on a fresh AI run themselves), no `approvals.*` (the formal
 * Approval Engine gate for HIGH/CRITICAL tool execution stays
 * employee-only - "approve allowed actions" means recommendations, via
 * `recommendations.review`, not that gate) and no `tasks.create`
 * (internal-only).
 */
export const ROLE_PERMISSIONS: Record<SystemRoleKey, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  employee: [
    'clients.read',
    'clients.edit',
    'approvals.approve',
    'approvals.request',
    'tasks.create',
    'reports.read',
    'recommendations.review',
    'feedback.create',
    'analysis.trigger',
    'content.manage',
    'ads.manage',
    'creative.manage',
  ],
  client: ['clients.read', 'reports.read', 'recommendations.review', 'feedback.create'],
}

/**
 * Roles whose client access is limited to their explicit ClientAssignment
 * rows, rather than every client in the organization. super_admin is
 * intentionally absent here (org-wide access, BRD Section 4.1); `client` is
 * handled separately (access via ClientUser rows, not ClientAssignment).
 */
export const SCOPED_CLIENT_ACCESS_ROLES: readonly SystemRoleKey[] = ['employee']
