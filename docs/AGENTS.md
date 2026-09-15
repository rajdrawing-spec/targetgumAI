# Agents — TargetGum AI Marketing OS

Status: **Marketing Analytics Agent implemented (Day 9); SEO, Competitor
(Phase 2), and Creative (Phase 2, Day 17) agents also implemented.**
`src/lib/agents/analytics-agent.ts`, the first real agent: Context Router → Tool
Registry (Metricool/GA4/GSC) → AI Gateway structured output. Read-only by
construction (every allowed tool is LOW risk). The Creative Agent
(`src/lib/agents/creative-agent.ts`) is architecturally different - it
produces creative CONCEPTS, not `Recommendation`s, and has an empty tool
allowlist like the Competitor Agent (see docs/DECISIONS.md). Orchestrator
and Client Intelligence agents remain design-only - there is no
natural-language command layer yet (BRD Section 44, Phase 2) for an
Orchestrator to sit behind, and every agent today assembles its own
Client Brain slice directly via the Context Router rather than through a
separate Client Intelligence Agent. This document records the agent
contract and the MVP agent set.

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
3. **Marketing Analytics Agent** — analyzes Metricool/Meta/Google/Amazon
   Ads data, GA4, and GSC; produces evidence-based findings, structured
   recommendations, and (Phase 3, `proposedActions` - BRD Section 61's
   automation levels) concrete, executable next steps (pause a campaign,
   change a budget) grounded only in real campaign ids from the data it
   was given. Still read-only by construction - the agent's own tool
   allowlist is unchanged (every entry LOW risk); a separate,
   non-AI orchestrator (`src/lib/automation/dispatch-proposed-actions.ts`)
   decides, from the client's own automation level and policy, whether a
   proposal becomes a pending Approval or an immediate execution - see
   docs/DECISIONS.md.
4. **Content Agent** — drafts content ideas, captions, calendars, copy.
5. **Creative Agent** ✅ implemented (Phase 2, Day 17,
   `src/lib/agents/creative-agent.ts`) — generates creative concepts
   (title/copy/visual description) from Client Brain context; never
   drives Canva itself (a separate step,
   `generateCreativeDesign`/`src/lib/creative/persist.ts`, calls
   `canva.create_design` directly - BRD Section 47's flow is explicitly
   two steps). Degrades gracefully by design: BRD Section 55/112 frame
   Canva as optional, and the design-generation step (not this agent)
   is what actually depends on it - concept generation never fails
   because Canva is unavailable.

SEO Agent and Competitor Agent (BRD Section 25's "Later" list) are also
implemented, brought forward as Phase 2 items - see docs/DECISIONS.md.

**Campaign Brief Agent** ✅ implemented (`src/lib/ads/campaign-brief.ts`) -
not in the original BRD list; backs the guided "Create Ad Campaign" wizard
(`/dashboard/ads/new`) built for someone with no digital marketing
experience. Turns three plain-language answers (what the campaign is
about, which platform, budget + audience) into a reviewable brief - a
campaign name, a jargon-free strategy note, and one draft ad. Empty tool
allowlist, same as the Creative/Competitor agents - it never executes
anything; the human-reviewed brief is handed to a separate, deterministic
step (`src/lib/ads/launch.ts`'s `launchCampaignFromWizard`) that calls the
real `{provider}.create_campaign` tool only once the human clicks
"Create." See docs/DECISIONS.md.

There is no standalone Advertising (execution) agent - Phase 3 gave the
Marketing Analytics Agent's own output an executable `proposedActions`
shape instead (see above), dispatched by deterministic (non-AI) code, not
by a second agent that decides to act. Website, Reporting, Client
Communication, Sales, Operations, and full Autonomous Optimization agents
remain unbuilt (BRD Section 25, 49).

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
