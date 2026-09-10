# Agents — TargetGum AI Marketing OS

Status: **Design draft.** No agents are implemented yet (Week 2, after the AI Gateway
foundation in Day 4). This document records the agent contract and the MVP agent set.

## Agent Contract (BRD-PRD Section 26)

Every agent definition must specify:

```text
Agent ID
Purpose
Allowed tools
Allowed actions
Required permissions
Input schema
Output schema
Risk rules
Client context requirements
Audit requirements
```

Agents have **no unrestricted tool access** — the Tool Registry checks an
agent's allowlist on every call, independent of what the model requests.

## MVP Agent Set (BRD-PRD Section 25)

1. **Orchestrator Agent** — interprets the user's natural-language request,
   resolves intent + client, and determines which workflow to run.
2. **Client Intelligence Agent** — assembles relevant Client Brain context for
   a given request via the Context Router.
3. **Marketing Analytics Agent** — analyzes Metricool ads/social data, GA4,
   and GSC; produces evidence-based findings and structured recommendations.
4. **Content Agent** — drafts content ideas, captions, calendars, copy.
5. **Creative Agent** — produces creative briefs and drives Canva MCP when
   available; degrades to brief-only output when it isn't.

No other agents are built for MVP. SEO, Advertising (execution), Competitor,
Website, Reporting, Client Communication, Sales, Operations, and Autonomous
Optimization agents are explicitly Phase 2+ (BRD Section 25, 49).

## Orchestration Flow (Context Architecture, BRD-PRD Section 7)

```text
User Request → Intent Detection → Client Identification → Permission Check
  → Context Router → Relevant Client Brain (not the whole brain) → Real-Time
  Data → Claude
```

Only the context slice relevant to the request is assembled — see
`docs/DATA-MODEL.md` (Client Brain) for why it's modeled as typed sub-tables
rather than one blob.

## Structured Output Discipline (BRD-PRD Section 71-72)

Application decisions (recommendations, risk levels, approval requirements)
are always Zod-validated structured JSON, never parsed from free text. Free
text is for presentation only. The system distinguishes, and never conflates:

```text
Observed fact → Calculated metric → AI inference → Recommendation → Action
```

Confidence is expressed explicitly (`Observed / Likely / Hypothesis /
Recommended test`) whenever causality is uncertain (BRD Section 39).

## AI Run Tracking

Every agent invocation produces an `ai_runs` record (model, prompt_version,
context_ids, tool_calls, tokens, cost, duration, status) per
`docs/DATA-MODEL.md`. No sensitive secrets are stored in prompts or logs.
