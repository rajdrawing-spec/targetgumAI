import { describe, expect, it } from 'vitest'
import { AuthenticationError, ForbiddenError } from '@/lib/rbac/errors'
import { assertClientAccess, assertPermission, requireAuthContext } from '@/lib/rbac/guards'
import type { AuthContext } from '@/lib/rbac/types'

function makeCtx(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'u1',
    organizationId: 'org1',
    roleKey: 'marketing_employee',
    permissions: new Set(['clients.read']),
    clientAccess: { kind: 'SET', clientIds: new Set(['client-a']) },
    isClientUser: false,
    ...overrides,
  }
}

describe('rbac guards (pure logic, no DB)', () => {
  it('assertPermission throws ForbiddenError when the permission is missing', () => {
    const ctx = makeCtx()
    expect(() => assertPermission(ctx, 'organizations.manage')).toThrow(ForbiddenError)
  })

  it('assertPermission passes when the permission is granted', () => {
    const ctx = makeCtx()
    expect(() => assertPermission(ctx, 'clients.read')).not.toThrow()
  })

  it('assertClientAccess denies a client outside the authorized set', () => {
    const ctx = makeCtx()
    expect(() => assertClientAccess(ctx, { id: 'client-b', organizationId: 'org1' })).toThrow(
      ForbiddenError,
    )
  })

  it('assertClientAccess denies a client from a different organization even with a matching id', () => {
    const ctx = makeCtx()
    expect(() => assertClientAccess(ctx, { id: 'client-a', organizationId: 'org2' })).toThrow(
      ForbiddenError,
    )
  })

  it('assertClientAccess allows an ALL-access role to reach any client in its organization', () => {
    const ctx = makeCtx({ roleKey: 'super_admin', clientAccess: { kind: 'ALL' } })
    expect(() => assertClientAccess(ctx, { id: 'anything', organizationId: 'org1' })).not.toThrow()
  })

  it('requireAuthContext throws AuthenticationError on a null context', () => {
    expect(() => requireAuthContext(null)).toThrow(AuthenticationError)
  })

  it('requireAuthContext returns the context unchanged when present', () => {
    const ctx = makeCtx()
    expect(requireAuthContext(ctx)).toBe(ctx)
  })
})
