# agents

`registry.ts` — `registerAgent()`: the mechanism for declaring an Agent Contract
(BRD-PRD Section 26) in code — purpose, allowed tools, input/output schema, risk
rules — and syncing it to the `Agent` + `AgentTool` rows that
`src/lib/tools/execute.ts` enforces against. Every tool key in `allowedToolKeys` must
already be registered via `src/lib/tools/registry.ts` or this throws — an agent can
never be granted a tool that doesn't exist.

`analytics-agent.ts` — the **Marketing Analytics Agent** (BRD Section 25.3), the
first real agent. `runMarketingAnalysis(input)`:

1. Context Router (`src/lib/clients/context-router.ts`) → the relevant Client Brain
   slice for `'analytics'`.
2. Gathers real-time data via the Tool Registry (Metricool social/ads,
   GA4, GSC) — a single integration failing is recorded as a data gap and the run
   continues; if *every* source fails, the agent returns early (`aiRunId: null`)
   without spending an AI call, rather than asking Claude to analyze nothing.
3. AI Gateway (`src/lib/ai/gateway.ts`) → structured findings/recommendations
   (`prompts/analytics/vN.md`), validated against a Zod schema matching BRD Section 39.

Read-only by construction — every tool in its allowlist is LOW risk, so it can never
execute an action, only analyze and recommend (BRD Section 19). Nothing it produces
is persisted yet — wiring results into the `recommendations` table, tasks, and
approvals is Day 10.

Orchestrator, Client Intelligence, Content, and Creative agents (BRD Section 25) don't
exist yet — later in Week 2/3. See docs/AGENTS.md.
