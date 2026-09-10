# integrations/gsc

Google Search Console `SEOProvider` adapter (queries, clicks, impressions, CTR,
position — BRD Section 36).

Same structure as `src/lib/integrations/ga4/`: `provider.ts` (real, via
`searchanalytics.query`), `mock-provider.ts` (`GSCMockProvider`), `index.ts`
(`resolveGSCProvider(connection)`), `tools.ts` (registers
`gsc.get_search_performance`). Shares the OAuth flow in
`src/lib/integrations/google/oauth.ts` with GA4. **Not live-verified** — see
docs/EXTERNAL-APPROVALS.md.
