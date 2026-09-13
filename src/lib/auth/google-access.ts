import { db } from '@/lib/db/client'

/**
 * Split out of src/lib/auth/config.ts so it has no `next-auth`/Next.js
 * imports at all - importing the full Auth.js config (even indirectly)
 * pulls in `next/server` via next-auth's own internals, which breaks
 * outside the Next.js runtime (vitest included) - see
 * tests/security/google-signin.test.ts.
 */

/** Whether `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set - gates both the provider and the sign-in page's button (docs/SECURITY.md - never offer a control that can't work). */
export function isGoogleLoginConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
}

/**
 * The one check that makes Google sign-in safe to allow
 * (`allowDangerousEmailAccountLinking` in src/lib/auth/config.ts): an
 * email only gets in if it already belongs to an ACTIVE User with real,
 * already-invited access - staff (an ACTIVE OrganizationUser) or a
 * client-portal user (a ClientUser row). "Continue with Google" is never
 * a self-service sign-up path (docs/DECISIONS.md, 2026-09-13) - the only
 * way anyone gets access at all is a Super Admin's email invitation
 * (src/lib/users/invitations.ts).
 */
export async function hasGoogleSignInAccess(email: string): Promise<boolean> {
  const existing = await db.user.findUnique({
    where: { email },
    select: {
      status: true,
      organizationUsers: { where: { status: 'ACTIVE' }, select: { id: true } },
      clientUsers: { select: { id: true } },
    },
  })
  return existing?.status === 'ACTIVE' && (existing.organizationUsers.length > 0 || existing.clientUsers.length > 0)
}
