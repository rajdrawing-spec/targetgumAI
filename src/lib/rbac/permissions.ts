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
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * `clients.manage` vs. `clients.edit` (added when the Client Portal/Phase-2
 * permission audit found this conflated, see docs/DECISIONS.md): `.manage`
 * is org-wide client *administration* - create a brand-new client
 * (`src/lib/clients/create.ts`), Super Admin only per BRD Section 4.1's
 * unscoped "Manage clients". `.edit` is narrower - update an
 * *already-accessible* client's Brain/Policy/brand assets/competitors
 * (`src/lib/clients/brain.ts`) - matches Account Manager's "manage
 * assigned clients" (Section 4.2): they can edit clients already assigned
 * to them (still enforced by `assertClientAccess`, not by this permission
 * alone), but not create new ones org-wide.
 *
 * `content.manage` (Phase 2 social content calendar, BRD Section 66/48/85):
 * covers the whole staff-side `ContentCalendarItem` lifecycle - create,
 * edit while draft, submit for review, approve, schedule (draft-only via
 * Metricool, never a real publish - `src/lib/integrations/metricool/
 * provider.ts`'s safety rule), cancel. Granted to `account_manager` and
 * `marketing_employee` both, deliberately not split into a separate
 * "approve" permission the way Approvals are: BRD 4.3 explicitly gives
 * Marketing Employee "Create/schedule social posts" (they can carry an item
 * through the whole lifecycle themselves), while 4.2's "Approve selected
 * actions" already covers Account Manager doing the same for someone
 * else's draft - one permission serves both without inventing a
 * restriction neither role list asks for. `client_user` gets none of this -
 * BRD 4.4 lists only "View content/creative" (read-only), served by the
 * existing `clients.read` grant everyone already has, same as reports.
 */
export const ROLE_PERMISSIONS: Record<SystemRoleKey, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  account_manager: [
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
  ],
  marketing_employee: [
    'clients.read',
    'approvals.request',
    'tasks.create',
    'reports.read',
    'recommendations.review',
    'analysis.trigger',
    'content.manage',
  ],
  // Client User (BRD Section 4.4): "View own dashboard, View reports,
  // Review recommendations, Approve allowed actions, Provide feedback,
  // View content/creative, Never access another client." Deliberately
  // narrower than staff: no `clients.edit` (can't rewrite their own Brain/
  // policy), no `analysis.trigger` (can't spend on a fresh AI run
  // themselves), no `approvals.*` (the formal Approval Engine gate for
  // HIGH/CRITICAL tool execution stays Account Manager+ per Section
  // 4.2/4.3 - "approve allowed actions" means recommendations, via
  // `recommendations.review`, not that gate) and no `tasks.create`
  // (internal-only, Section 4.2/4.3).
  client_user: ['clients.read', 'reports.read', 'recommendations.review', 'feedback.create'],
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
