/**
 * Shared outbound email helper. Two call sites use this: Auth.js's
 * Nodemailer (magic-link) provider (`src/lib/auth/config.ts`) and the
 * invitation flow (`src/lib/users/invitations.ts`) - both need the same
 * "send this if SMTP is configured, otherwise log it locally" behavior, so
 * it lives in one place rather than being copied.
 *
 * Never throws secrets into logs - the dev fallback logs the recipient and
 * the link/body text, never SMTP credentials.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER_HOST)
}

function buildEmailServer() {
  return {
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  }
}

export interface SendMailInput {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Sends via SMTP when `EMAIL_SERVER_HOST` is configured. Otherwise: throws
 * in production (never silently drop an email a user is waiting on), warns
 * to the console in development so the link/body is still visible to
 * whoever is testing locally.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_SERVER_HOST is not configured - cannot send email.')
    }
    console.warn(`[dev email] to=${input.to} subject="${input.subject}"\n${input.text}`)
    return
  }

  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(buildEmailServer())
  await transport.sendMail({
    to: input.to,
    from: process.env.EMAIL_FROM,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}
