# External Approval Tracker — TargetGum AI Marketing OS

Per BRD-PRD Section 90. External approval timelines are dependencies, not guaranteed
delivery dates (Section 91) — development proceeds against mock providers wherever an
item below is not yet `CONNECTED`.

| Provider | Application | Required Credentials | Status | Submitted | Expected Window | Owner | Blocker | Next Action |
|---|---|---|---|---|---|---|---|---|
| Claude / Anthropic | API access | `ANTHROPIC_API_KEY` | **NEEDED** | — | Immediate (self-serve) | TargetGum | No key provided yet | User provides API key before Day 4 (AI Gateway) |
| Metricool | Account + API/MCP access | Metricool account API key, brand mapping | **PARTIAL** | — | — | TargetGum | An MCP connection is live in this dev session, but not confirmed as the intended pilot-client brand, and its tool list has no ads endpoints (social scheduling/analytics + brand settings only) | Confirm target account + whether ads read/write is on the account's plan before Day 6 |
| GA4 | OAuth app + property access | Google Cloud OAuth client, property ID per client | **NEEDED** | — | — | TargetGum | No OAuth app or pilot property confirmed | User provides GA4 property access for pilot client before Day 7 |
| Google Search Console | OAuth app + property access | Same Google Cloud OAuth client, verified property | **NEEDED** | — | — | TargetGum | Same as above | User provides GSC property access for pilot client before Day 7 |
| Canva | Developer/MCP access | Canva Developer app, OAuth client | **OPTIONAL / NOT STARTED** | — | Uncertain | TargetGum | Optional in MVP per BRD Section 55 | Apply only if creative workflow (Phase after MVP analytics) is prioritized |
| Google Ads | Native API access | Developer token, Google Cloud project, OAuth, test accounts | **NOT NEEDED FOR MVP** | — | Phase 2 | TargetGum | — | Defer until Metricool proves insufficient for ads management |
| Meta | Native API access | Meta developer app, OAuth, app review | **NOT NEEDED FOR MVP** | — | Phase 2 | TargetGum | — | Defer |
| Amazon Ads | Native API access | Amazon Ads API access application | **NOT NEEDED FOR MVP** | — | Phase 3 | TargetGum | — | Defer |

Update this table as each item's status changes. "PARTIAL" means a connection exists
but scope/suitability for production is unconfirmed — treat it the same as "NEEDED"
for anything beyond mock-provider development until confirmed.
