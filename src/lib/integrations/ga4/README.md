# integrations/ga4

GA4 `AnalyticsProvider` adapter (traffic, engagement, conversions, campaign
performance — BRD Section 35).

- `provider.ts` — the real adapter (`createGA4Provider(oauth2Client)`), wrapping the
  GA4 Data API's `runReport` via the official `googleapis` client. **Not
  live-verified** — no real Google Cloud OAuth app/property configured anywhere this
  code has run (docs/EXTERNAL-APPROVALS.md).
- `mock-provider.ts` — `GA4MockProvider`, full deterministic implementation.
- `index.ts` — `resolveGA4Provider(connection)`: real adapter when
  `GA4_OAUTH_CLIENT_ID`/`SECRET` are set AND the specific connection has a stored
  refresh token; otherwise the mock. Resolved per-connection (unlike Metricool's
  single org-wide provider), since GA4 credentials are per-client OAuth, not a shared
  API key.
- `tools.ts` — registers `ga4.get_report` (BRD Section 13's own example list).

OAuth flow itself (`buildGoogleAuthUrl`/`exchangeGoogleAuthCode`) lives in
`src/lib/integrations/google/oauth.ts`, shared with GSC.
