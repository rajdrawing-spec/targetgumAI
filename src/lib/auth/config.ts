import { PrismaAdapter } from '@auth/prisma-adapter'
import { CredentialsSignin, type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Nodemailer from 'next-auth/providers/nodemailer'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { isEmailConfigured, sendMail } from '@/lib/email/mailer'
import { verifyMfaToken } from './mfa'
import { verifyPassword } from './password'

/**
 * Auth.js v5 configuration. See docs/DECISIONS.md for why this is
 * self-hosted (Auth.js + Prisma adapter + custom TOTP MFA + custom RBAC)
 * rather than a turnkey auth platform.
 *
 * Session strategy is JWT: the Credentials provider "can only be used if
 * JSON Web Tokens are enabled for sessions" (Auth.js constraint - Credentials
 * sign-ins aren't persisted through the adapter the way OAuth sign-ins are).
 * The Prisma adapter is still wired in for the Nodemailer (magic link)
 * provider, which uses `VerificationToken` regardless of session strategy.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
})

// Distinct error codes so the sign-in form can tell "wrong password" apart
// from "enter your authenticator code now" without leaking which credential
// field was wrong (docs/SECURITY.md - be generic with client-side errors).
class InvalidCredentialsError extends CredentialsSignin {
  code = 'invalid_credentials'
}
class MfaRequiredError extends CredentialsSignin {
  code = 'mfa_required'
}
class InvalidMfaError extends CredentialsSignin {
  code = 'invalid_mfa'
}

/**
 * The Nodemailer provider unconditionally requires a truthy `server` at
 * construction time even though we override `sendVerificationRequest`
 * ourselves below and never call `createTransport(provider.server)` - so
 * when SMTP isn't configured we still pass a placeholder value (never
 * actually connected to) and let `sendMail` (`src/lib/email/mailer.ts`)
 * gate the real fallback behavior.
 */
async function sendVerificationRequest(params: { identifier: string; url: string }) {
  await sendMail({
    to: params.identifier,
    subject: 'Sign in to TargetGum AI Marketing OS',
    text: `Sign in: ${params.url}`,
    html: `<p><a href="${params.url}">Sign in to TargetGum AI Marketing OS</a></p>`,
  })
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  // Auth.js v5 only auto-trusts the incoming request's Host header on
  // Vercel (it detects the VERCEL env var). On any other Node host -
  // Hostinger, Railway, a bare VPS - every auth request (including the
  // unauthenticated GET /api/auth/providers the sign-in page calls before
  // any credentials are submitted) throws `UntrustedHost` synchronously,
  // which surfaces to the browser as a 500 with no further detail. Trust
  // the host explicitly so self-hosted deployments work; this app has no
  // other logic that makes a security decision from the Host header.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'Authenticator code', type: 'text' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials)
        if (!parsed.success) throw new InvalidCredentialsError()
        const { email, password, totpCode } = parsed.data

        const user = await db.user.findUnique({ where: { email } })
        // Same generic error for "no such user", "disabled user", and
        // "wrong password" - never hint which one it was (docs/SECURITY.md).
        if (!user || user.status !== 'ACTIVE' || !user.passwordHash) {
          throw new InvalidCredentialsError()
        }

        const validPassword = await verifyPassword(password, user.passwordHash)
        if (!validPassword) throw new InvalidCredentialsError()

        if (user.mfaEnabled) {
          if (!totpCode) throw new MfaRequiredError()
          if (!user.mfaSecret || !verifyMfaToken(user.mfaSecret, totpCode)) {
            throw new InvalidMfaError()
          }
        }

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
    Nodemailer({
      // Placeholder - never actually connected to. We override
      // sendVerificationRequest below, which goes through
      // src/lib/email/mailer.ts's own SMTP config instead; the provider
      // just requires a truthy `server` at construction time.
      server: { host: 'localhost', port: 25 },
      from: process.env.EMAIL_FROM,
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub
      return session
    },
  },
}
