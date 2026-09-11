# integrations/canva

`CreativeProvider` adapter for Canva (Phase 2, BRD Section 17/47/55/67/112) -
"the first creative provider," treated as optional per BRD Section 55 and
required to degrade gracefully if unavailable (Section 112).

- `mock-provider.ts` — `CanvaMockProvider`, full deterministic
  implementation (BRD Section 92 names this explicitly). What every tool,
  the Creative Agent's downstream design-generation step, and every test
  in this codebase actually exercises today.
- `provider.ts` — the real adapter, `createCanvaProvider()`. Every method
  throws `UnsupportedOperationError` - no Canva MCP connection has ever
  been available in this environment to verify tool names/schemas
  against, unlike Metricool's (checked live in an earlier session). See
  the file's own doc comment and `docs/EXTERNAL-APPROVALS.md`.
- `index.ts` — `resolveCanvaProvider()`: real adapter when `CANVA_MCP_URL`
  is set (still throws today, per above), otherwise the mock.
- `tools.ts` — registers `canva.search_designs`/`search_assets` (LOW),
  `canva.create_design`/`edit_design`/`export_design` (MEDIUM, gated on
  the new `creative.manage` permission).
- `connect.ts` — `connectClientToCanvaAccount`, single-step
  connect-and-verify (same shape as Metricool/Google Ads/Meta Ads).

BRD Section 55's four Canva connectivity states (connected / not
connected / authorization expired / unavailable) map directly onto the
existing generic `IntegrationHealth` enum
(`CONNECTED`/no-connection-row/`AUTH_REQUIRED`/`ERROR`) - no
Canva-specific state machine was needed.
