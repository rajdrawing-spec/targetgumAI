import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildGoogleAuthUrl, isGoogleIntegrationConfigured } from '@/lib/integrations/google/oauth'

/**
 * Covers what's testable without a live Google OAuth app: URL construction
 * (pure, no network) and the configured/not-configured branches. Token
 * exchange (exchangeGoogleAuthCode) delegates to google-auth-library's own
 * network call and isn't independently re-tested here - see
 * docs/MVP-CHECKLIST.md for this documented gap.
 */
describe('Google OAuth helper', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.GA4_OAUTH_CLIENT_ID
    delete process.env.GA4_OAUTH_CLIENT_SECRET
    delete process.env.GSC_OAUTH_CLIENT_ID
    delete process.env.GSC_OAUTH_CLIENT_SECRET
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('isGoogleIntegrationConfigured is false when env vars are unset', () => {
    expect(isGoogleIntegrationConfigured('GA4')).toBe(false)
    expect(isGoogleIntegrationConfigured('GOOGLE_SEARCH_CONSOLE')).toBe(false)
  })

  it('isGoogleIntegrationConfigured is true once both client id and secret are set', () => {
    process.env.GA4_OAUTH_CLIENT_ID = 'test-client-id'
    process.env.GA4_OAUTH_CLIENT_SECRET = 'test-client-secret'
    expect(isGoogleIntegrationConfigured('GA4')).toBe(true)
    expect(isGoogleIntegrationConfigured('GOOGLE_SEARCH_CONSOLE')).toBe(false)
  })

  it('buildGoogleAuthUrl throws a clear error when not configured', () => {
    expect(() => buildGoogleAuthUrl('GA4', 'https://app.test/callback', 'state123')).toThrow(
      /GA4_OAUTH_CLIENT_ID/,
    )
  })

  it('buildGoogleAuthUrl builds a well-formed consent URL with offline access and the readonly scope', () => {
    process.env.GA4_OAUTH_CLIENT_ID = 'test-client-id'
    process.env.GA4_OAUTH_CLIENT_SECRET = 'test-client-secret'

    const url = new URL(buildGoogleAuthUrl('GA4', 'https://app.test/callback', 'state123'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/callback')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('state123')
    expect(url.searchParams.get('scope')).toContain('analytics.readonly')
  })

  it('builds a distinct scope for Search Console', () => {
    process.env.GSC_OAUTH_CLIENT_ID = 'test-client-id'
    process.env.GSC_OAUTH_CLIENT_SECRET = 'test-client-secret'

    const url = new URL(buildGoogleAuthUrl('GOOGLE_SEARCH_CONSOLE', 'https://app.test/callback', 'state123'))
    expect(url.searchParams.get('scope')).toContain('webmasters.readonly')
  })
})
