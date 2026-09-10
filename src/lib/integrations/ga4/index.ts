import { loadProviderCredentials, type ResolvedProviderConnection } from '../health'
import { buildGoogleOAuth2Client, isGoogleIntegrationConfigured } from '../google/oauth'
import type { AnalyticsProvider } from '../providers'
import { GA4MockProvider } from './mock-provider'
import { createGA4Provider } from './provider'

/**
 * Resolves the AnalyticsProvider to use for one resolved connection. Real
 * adapter when GA4_OAUTH_CLIENT_ID/SECRET are configured AND this specific
 * connection has a stored refresh token; otherwise the mock (BRD Section
 * 92), with a warning so mock data is never silently mistaken for real
 * data. Unlike Metricool's single org-wide provider, this must be resolved
 * per-connection since GA4 credentials are per-client (OAuth), not a
 * shared API key.
 */
export function resolveGA4Provider(connection: ResolvedProviderConnection): AnalyticsProvider {
  if (!isGoogleIntegrationConfigured('GA4')) {
    console.warn('[ga4] GA4_OAUTH_CLIENT_ID/SECRET not configured - using GA4MockProvider.')
    return GA4MockProvider
  }
  const credentials = loadProviderCredentials<{ refreshToken: string }>(connection)
  if (!credentials?.refreshToken) {
    console.warn('[ga4] Connection has no stored refresh token - using GA4MockProvider.')
    return GA4MockProvider
  }
  return createGA4Provider(buildGoogleOAuth2Client('GA4', credentials.refreshToken))
}

export { GA4MockProvider } from './mock-provider'
export { createGA4Provider } from './provider'
