# Approval Engine — TargetGum AI Marketing OS

Status: **Design draft — not yet implemented.** Scheduled for Day 10 per
`docs/MVP-CHECKLIST.md`. Until then, `src/lib/tools/execute.ts` (Day 5) hard-blocks
every HIGH/CRITICAL-risk tool call rather than executing it unapproved or building a
partial stub — see `docs/DECISIONS.md`. LOW/MEDIUM-risk tools already execute through
the full authorization chain (permission, client access, agent allowlist) and are
fully audited; only the approval step itself is missing.

## Risk Classification (BRD-PRD Section 21)

| Level | Examples | Default |
|---|---|---|
| LOW | Read data, analyze, generate report, draft content, generate recommendations | Automatic |
| MEDIUM | Create internal tasks, create draft campaign, generate creative, prepare scheduled content | Configurable (client policy) |
| HIGH | Publish content, launch campaign, change ad budget, change bids, change targeting | Approval required |
| CRITICAL | Delete campaigns, delete client data, change permissions, change billing, destructive production actions | Approval always required, no override |

Every agent/tool action declares its risk level in the Tool Registry
(`risk_level` field, `docs/ARCHITECTURE.md` / BRD Section 13). Client policy
(`client_policies`) can tighten MEDIUM/HIGH defaults but can never downgrade
CRITICAL or bypass it automatically.

## Approval Object (BRD-PRD Section 22)

```text
approval_id, organization_id, client_id, requested_by, agent_id, action_type,
risk_level, action_summary, proposed_changes, estimated_impact, status,
approved_by, approved_at, rejected_reason, expires_at
```

Status: `PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED | EXECUTED |
FAILED`.

## Approval Screen (BRD-PRD Section 63)

Every approval request presents: Client, Action, Why, Current state,
Proposed change, Expected impact, Risk, Evidence, and Approve / Reject / Edit
actions. The goal is fast, informed human judgment on exceptions — not
routine manual work.

## Automation Levels (BRD-PRD Section 61)

Each client has one automation setting:

```text
MANUAL          — AI recommends; humans execute everything
ASSISTED        — AI drafts and prepares actions
APPROVAL_BASED  — AI executes approved workflows
HIGH_AUTOMATION — low-risk actions execute automatically; high-risk still needs approval
```

CRITICAL actions never bypass explicit policy regardless of automation level.

## Recommendation → Approval → Execution Lifecycle (BRD-PRD Section 107)

```text
DETECTED → ANALYZED → RECOMMENDED → ACCEPTED/REJECTED → APPROVED → EXECUTED
  → VERIFIED → CLOSED
```

This lifecycle is what lets TargetGum measure whether AI recommendations
actually produce useful outcomes (acceptance rate, rejection rate, false
positives — see `docs/MVP-CHECKLIST.md` metrics section once defined).
