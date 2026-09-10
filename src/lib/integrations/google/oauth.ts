import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

/**
 * Shared Google OAuth2 helper for GA4 and Search Console - both are Google
 * APIs using the same three-legged OAuth flow, just different scopes and
 * env var pairs. Not live-verified (no real Google Cloud OAuth app
 * configured in this environment) - see docs/EXTERNAL-APPROVALS.md. The
 * API surface itself (google-auth-library's OAuth2Client) is Google's
 * stable, official client library, not guessed.
 */

export type GoogleIntegration = 'GA4' | 'GOOGLE_SEARCH_CONSOLE'

const SCOPES: Record<GoogleIntegration, string[]> = {
  GA4: ['https://www.googleapis.com/auth/analytics.readonly'],
  GOOGLE_SEARCH_CONSOLE: ['https://www.googleapis.com/auth/webmasters.readonly'],
}

function getEnvCredentials(integration: GoogleIntegration): { clientId: string; clientSecret: string } | null {
  const clientId =
    integration === 'GA4' ? process.env.GA4_OAUTH_CLIENT_ID : process.env.GSC_OAUTH_CLIENT_ID
  const clientSecret =
    integration === 'GA4' ? process.env.GA4_OAUTH_CLIENT_SECRET : process.env.GSC_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function isGoogleIntegrationConfigured(integration: GoogleIntegration): boolean {
  return getEnvCredentials(integration) !== null
}

function requireEnvCredentials(integration: GoogleIntegration): { clientId: string; clientSecret: string } {
  const creds = getEnvCredentials(integration)
  if (!creds) {
    throw new Error(
      `${integration === 'GA4' ? 'GA4_OAUTH_CLIENT_ID/SECRET' : 'GSC_OAUTH_CLIENT_ID/SECRET'} is not configured (see .env.example).`,
    )
  }
  return creds
}

/** Step 1 of the OAuth flow: the URL to send the user to for consent. */
export function buildGoogleAuthUrl(
  integration: GoogleIntegration,
  redirectUri: string,
  state: string,
): string {
  const { clientId, clientSecret } = requireEnvCredentials(integration)
  const client = new google.auth.OAuth2({ clientId, clientSecret, redirectUri })
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent', // force refresh_token on repeat consent too
    scope: SCOPES[integration],
    state,
  })
}

/** Step 2: exchanges the authorization code from the OAuth callback for tokens. */
export async function exchangeGoogleAuthCode(
  integration: GoogleIntegration,
  redirectUri: string,
  code: string,
): Promise<{ refreshToken: string; accessToken?: string; expiryDate?: number }> {
  const { clientId, clientSecret } = requireEnvCredentials(integration)
  const client = new google.auth.OAuth2({ clientId, clientSecret, redirectUri })
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. This happens on repeat consent without prompt=consent, or if access_type was not "offline" - retry the connect flow.',
    )
  }
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
  }
}

/**
 * Builds an authenticated client from a stored refresh token. Access-token
 * refresh happens automatically inside google-auth-library on each API
 * call that needs it - callers don't manage expiry themselves.
 */
export function buildGoogleOAuth2Client(integration: GoogleIntegration, refreshToken: string): OAuth2Client {
  const { clientId, clientSecret } = requireEnvCredentials(integration)
  const client = new google.auth.OAuth2({ clientId, clientSecret })
  client.setCredentials({ refresh_token: refreshToken })
  return client
}
