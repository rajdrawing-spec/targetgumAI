# External Approval Tracker — TargetGum AI Marketing OS

Per BRD-PRD Section 90. External approval timelines are dependencies, not guaranteed
delivery dates (Section 91) — development proceeds against mock providers wherever an
item below is not yet `CONNECTED`.

| Provider | Application | Required Credentials | Status | Submitted | Expected Window | Owner | Blocker | Next Action |
|---|---|---|---|---|---|---|---|---|
| Claude / Anthropic | API access | `ANTHROPIC_API_KEY` | **STILL NEEDED** | — | Immediate (self-serve) | TargetGum | AI Gateway (Day 4) is built and its orchestration logic (retries, ai_runs persistence, structured-output validation) is verified against a mocked client, but no live call against the real API has been made — no key configured in this environment | User provides API key so a live smoke test can run and Day 9+ (real agents) can be verified end-to-end |
| Metricool | Account + API/MCP access | `METRICOOL_MCP_URL` + `METRICOOL_API_KEY` for the deployed app (separate from this dev session's own MCP connection) | **ADAPTER BUILT, NOT LIVE-CONNECTED** | — | — | TargetGum | The MetricoolProvider adapter (Day 6) is built and unit-tested against verified tool schemas (checked live via this session's own Metricool MCP connection, account `info@tapashub.com`, across 5 brands: HUGFAB, LHO, TargetGum, undertreegames, Pepalworks). But the **deployed application** has no `METRICOOL_MCP_URL`/`METRICOOL_API_KEY` of its own — this session's MCP connection isn't reachable from the app's own runtime. Ads *write/management* is confirmed unavailable via Metricool regardless (capability gap in the MCP server itself, not account-plan). Only LHO and undertreegames have a connected ads account today (Facebook/Meta Ads; no Google Ads connected on any brand). See `docs/DECISIONS.md` for full findings. | User provides a real `METRICOOL_MCP_URL` + `METRICOOL_API_KEY` for the app to connect with, and confirms which brand is the pilot client, so a live smoke test can run (like the Day 3 auth one) |
| GA4 | OAuth app + property access | Google Cloud OAuth client, property ID per client | **NEEDED** | — | — | TargetGum | No OAuth app or pilot property confirmed | User provides GA4 property access for pilot client before Day 7 |
| Google Search Console | OAuth app + property access | Same Google Cloud OAuth client, verified property | **NEEDED** | — | — | TargetGum | Same as above | User provides GSC property access for pilot client before Day 7 |
| Canva | Developer/MCP access | Canva Developer app, OAuth client | **OPTIONAL / NOT STARTED** | — | Uncertain | TargetGum | Optional in MVP per BRD Section 55 | Apply only if creative workflow (Phase after MVP analytics) is prioritized |
| Google Ads | Native API access | Developer token, Google Cloud project, OAuth, test accounts | **NOT NEEDED FOR MVP** | — | Phase 2 | TargetGum | — | Defer until Metricool proves insufficient for ads management |
| Meta | Native API access | Meta developer app, OAuth, app review | **NOT NEEDED FOR MVP** | — | Phase 2 | TargetGum | — | Defer |
| Amazon Ads | Native API access | Amazon Ads API access application | **NOT NEEDED FOR MVP** | — | Phase 3 | TargetGum | — | Defer |

Update this table as each item's status changes. "PARTIAL" means a connection exists
but scope/suitability for production is unconfirmed — treat it the same as "NEEDED"
for anything beyond mock-provider development until confirmed.
