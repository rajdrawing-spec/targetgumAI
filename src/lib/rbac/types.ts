import type { Permission, SystemRoleKey } from './permissions'

export type ClientAccess =
  | { kind: 'ALL' }
  | { kind: 'SET'; clientIds: ReadonlySet<string> }

/**
 * The fully-resolved authorization context for one user acting within one
 * organization. Every client-scoped operation must check against this, not
 * against a caller-supplied clientId alone (docs/SECURITY.md).
 */
export interface AuthContext {
  userId: string
  organizationId: string
  /** Present for staff (an OrganizationUser); absent for a pure Client User. */
  organizationUserId?: string
  roleKey: SystemRoleKey | string
  permissions: ReadonlySet<Permission>
  clientAccess: ClientAccess
  isClientUser: boolean
}
