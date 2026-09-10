# ai

The AI Gateway (BRD-PRD Section 11) — the one place application code calls Claude.

- `client.ts` — lazy Anthropic client singleton (constructed on first use, not at
  import time; see docs/DECISIONS.md for why)
- `models.ts` — named model tiers (`fast`/`default`/`reasoning`) and cost estimation
- `prompts.ts` — versioned prompt loading (`prompts/<category>/vN.md`) + safe
  `{{variable}}` interpolation (refuses anything that looks like a secret name)
- `gateway.ts` — `runStructuredAiTask`: the orchestration function. Loads a prompt,
  calls Claude with native structured outputs (`output_config.format` +
  `zodOutputFormat`), retries transient failures, and persists an `ai_runs` row for
  every attempt (never skipped, success or failure)
- `errors.ts` — typed error classes (`AiGatewayError`, `InvalidAiOutputError`,
  `PromptNotFoundError`, `PromptVariableError`)

**Not in scope here yet:** tool permission checking / actual tool use (no Tool
Registry until Day 5 — this gateway runs single structured-output calls only) and
Context Router / Client Brain assembly (Day 8). Agents (Day 9+) call
`runStructuredAiTask` rather than the Anthropic SDK directly.

**Gotcha:** schemas passed to `runStructuredAiTask` must be built with
`import { z } from 'zod/v4'`, not the classic `import { z } from 'zod'` used
elsewhere in the app (`src/lib/auth/`, etc.) — see docs/DECISIONS.md.
