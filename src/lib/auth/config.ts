import { PrismaAdapter } from '@auth/prisma-adapter'
import { CredentialsSignin, type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Nodemailer from 'next-auth/providers/nodemailer'
import { z } from 'zod'
import { db } from '@/lib/db/client'
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
 * when SMTP isn't configured we still return a placeholder value here (it's
 * never actually connected to) and let `isEmailConfigured()` gate the real
 * fallback behavior in `sendVerificationRequest`.
 */
function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER_HOST)
}

function buildEmailServer() {
  if (!isEmailConfigured()) {
    return { host: 'localhost', port: 25 }
  }
  return {
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  }
}

async function sendVerificationRequest(params: { identifier: string; url: string }) {
  if (!isEmailConfigured()) {
    // Local/dev fallback when no SMTP is configured (.env.example) - never
    // do this in production.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_SERVER_HOST is not configured - cannot send magic link email.')
    }
    console.warn(`[dev magic link] ${params.identifier} -> ${params.url}`)
    return
  }

  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(buildEmailServer())
  await transport.sendMail({
    to: params.identifier,
    from: process.env.EMAIL_FROM,
    subject: 'Sign in to TargetGum AI Marketing OS',
    text: `Sign in: ${params.url}`,
    html: `<p><a href="${params.url}">Sign in to TargetGum AI Marketing OS</a></p>`,
  })
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
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
      server: buildEmailServer(),
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
