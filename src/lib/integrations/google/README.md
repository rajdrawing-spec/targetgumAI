# integrations/google

Shared Google OAuth2 helper (`oauth.ts`) for GA4 and Search Console — both are
Google APIs using the same three-legged OAuth flow with different scopes and env var
pairs (`GA4_OAUTH_CLIENT_ID`/`SECRET`, `GSC_OAUTH_CLIENT_ID`/`SECRET`):

- `buildGoogleAuthUrl(integration, redirectUri, state)` — step 1, the consent URL.
- `exchangeGoogleAuthCode(integration, redirectUri, code)` — step 2, code → refresh
  token (stored via `src/lib/integrations/health.ts`'s `saveProviderCredentials`,
  envelope-encrypted).
- `buildGoogleOAuth2Client(integration, refreshToken)` — builds an authenticated
  client from a stored refresh token; access-token refresh happens automatically.

No consent-flow UI/route exists yet (that's Day 13, dashboard) — this is the
mechanism only, same scope pattern as Day 6's Metricool connection helpers.
