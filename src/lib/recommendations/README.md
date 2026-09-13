# recommendations

Recommendation persistence and lifecycle (BRD-PRD Section 39, 107), task creation
(Section 40), and the routing decision between the two (Section 24).

- `persist.ts` — `persistRecommendations` (from a Marketing Analytics Agent run,
  `src/lib/agents/analytics-agent.ts`), `listRecommendations`/`listRecommendationsForOrg`,
  `getRecommendation`, `acceptRecommendation`, `rejectRecommendation` (which also
  records the rejection as `ClientFeedback` — BRD Section 108's "learning from
  feedback" loop, back to Day 8's Client Brain, correctly attributed `source: CLIENT`
  vs. `ACCOUNT_MANAGER` by `ctx.isClientUser`). Accept/reject are gated by
  `recommendations.review` (Phase 2 - granted to `employee` and `client`;
  deliberately NOT `approvals.request`,
  which is the separate, more sensitive formal Approval Engine permission - see
  `src/lib/approvals/README.md` and docs/DECISIONS.md).
- `tasks.ts` — `createTaskFromRecommendation`, `listTasks`, `updateTaskStatus`. Gated
  by `tasks.create`, not `clients.manage` — any Employee can
  create tasks (BRD Section 4.2-4.3); a Client cannot (Section 4.4).
- `route.ts` — `routeRecommendation`: BRD Section 24's daily-workflow decision. A
  recommendation that's HIGH/CRITICAL priority or flagged `requiresApproval` gets an
  Approval request (`src/lib/approvals/`) instead of a task — everything else gets a
  task for a human to action normally.
