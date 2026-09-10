# agents

`registry.ts` — `registerAgent()`: the mechanism for declaring an Agent Contract
(BRD-PRD Section 26) in code — purpose, allowed tools, input/output schema, risk
rules — and syncing it to the `Agent` + `AgentTool` rows that
`src/lib/tools/execute.ts` enforces against. Every tool key in `allowedToolKeys` must
already be registered via `src/lib/tools/registry.ts` or this throws — an agent can
never be granted a tool that doesn't exist.

No real agents exist yet (Orchestrator, Client Intelligence, Marketing Analytics,
Content, Creative — BRD Section 25). That's Day 9+, once the AI Gateway
(`src/lib/ai/`) and a real Client Brain (Day 8) exist for them to reason over. See
docs/AGENTS.md.
