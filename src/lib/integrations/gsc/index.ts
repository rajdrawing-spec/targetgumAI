import { loadProviderCredentials, type ResolvedProviderConnection } from '../health'
import { buildGoogleOAuth2Client, isGoogleIntegrationConfigured } from '../google/oauth'
import type { SEOProvider } from '../providers'
import { GSCMockProvider } from './mock-provider'
import { createGSCProvider } from './provider'

/** Same resolution pattern as GA4 - see src/lib/integrations/ga4/index.ts. */
export function resolveGSCProvider(connection: ResolvedProviderConnection): SEOProvider {
  if (!isGoogleIntegrationConfigured('GOOGLE_SEARCH_CONSOLE')) {
    console.warn('[gsc] GSC_OAUTH_CLIENT_ID/SECRET not configured - using GSCMockProvider.')
    return GSCMockProvider
  }
  const credentials = loadProviderCredentials<{ refreshToken: string }>(connection)
  if (!credentials?.refreshToken) {
    console.warn('[gsc] Connection has no stored refresh token - using GSCMockProvider.')
    return GSCMockProvider
  }
  return createGSCProvider(buildGoogleOAuth2Client('GOOGLE_SEARCH_CONSOLE', credentials.refreshToken))
}

export { GSCMockProvider } from './mock-provider'
export { createGSCProvider } from './provider'
