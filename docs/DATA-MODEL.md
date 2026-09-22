# Data Model — TargetGum AI Marketing OS

Status: **Implemented.** All tables below exist in `prisma/schema.prisma` and are
applied via `prisma/migrations/20260910092421_init`. A few modeling choices made
during implementation aren't spelled out below — see the "2026-09-10 — Full Data
Model schema implemented" entry in `docs/DECISIONS.md` for the deltas (notably:
`ClientBrain` narrative sections as validated JSON columns rather than one table per
section; provenance + `raw` columns on every normalized metric table).

## Tenancy Invariant

Every client-owned table has `organization_id`, `client_id`, `created_by`, `created_at`,
`updated_at`. Nullable FK columns (`user_id`, `integration_id`, `workflow_id`, `ai_run_id`,
`approval_id`) are added where relevant. **Application code never trusts a caller-supplied
`client_id` without checking it against the resolved session's authorized client set** —
see `docs/SECURITY.md`.

## Core Tables (BRD-PRD Section 32)

```text
organizations            — top-level tenant
users                     — people; global identity, not tenant-scoped
organization_users        — membership + org-level role
roles                     — named role definitions (Super Admin, Account Manager,
                             Marketing Employee, Client User)
permissions               — granular permission keys
clients                   — an agency's managed client/brand
client_users              — client-portal user access (Client User role)
client_brain              — structured knowledge: business, audience, brand,
                             marketing, competitors, policies, feedback (see below)
client_brand_assets       — logos, colors, fonts, approved/restricted imagery refs
client_policies           — max budget, max budget change %, auto-publish flags,
                             approval requirements, weekly automation opt-in
                             (BRD Section 62/65)
integrations              — provider-level config per org (e.g. "Metricool")
integration_accounts      — an org's account with that provider
integration_connections   — OAuth/credential connection, one per client-to-account
                             mapping; secrets stored envelope-encrypted, never plaintext
ai_runs                   — every AI Gateway invocation (BRD Section 27)
agents                    — agent definitions/contracts (BRD Section 26)
agent_tools               — allowlist: which tools an agent may call
tool_executions            — every tool call, input/output summary, result
workflows                 — workflow definitions
workflow_runs              — a single execution of a workflow
workflow_steps              — individual steps within a run (for pause/resume, retries)
tasks                     — internal work items (BRD Section 40)
approvals                 — pending/approved/rejected high-risk actions (BRD Section 22)
audit_events               — append-only, protected from ordinary users (BRD Section 28)
reports                   — generated internal/client reports
notifications             — in-app/email/(later Slack/WhatsApp) notifications;
                             organizationId/clientId (optional)/userId
                             (recipient)/channel/type/title/body/link/readAt -
                             see docs/DECISIONS.md (Phase 4)
```

## Marketing Tables (BRD-PRD Section 32)

```text
campaigns          — internal_campaign_id, provider, provider_campaign_id, client_id, ...
campaign_metrics    — normalized (spend, impressions, clicks, CTR, CPC, CPM,
                       conversions, CPA, ROAS, ...) + source/retrieved_at/period
social_posts        — content calendar item lifecycle (IDEA→...→PUBLISHED/FAILED/CANCELLED)
social_metrics       — normalized (reach, impressions, engagement, likes, comments,
                       shares, saves, clicks, followers, video_views, watch_time)
seo_metrics          — GSC-sourced (queries, clicks, impressions, CTR, position)
analytics_snapshots  — GA4-sourced point-in-time snapshots
recommendations      — structured AI output (priority, area, finding, evidence,
                       likely_cause, recommendation, expected_impact, confidence,
                       requires_approval) + lifecycle status (BRD Section 107)
content_calendar     — platform, publish_date, status, caption, creative ref, approval ref
creative_assets      — creative_id, platform, campaign, concept, copy, design_url,
                       export_url, provider, status, approval, created_by
```

Every provider-linked record keeps both `internal_*_id` and `(provider,
provider_*_id)` so the app can reconcile with vendor data without depending on
vendor ID stability across reconnects.

## Client Brain — structured knowledge layer (BRD-PRD Section 6)

Modeled as a small set of typed sub-tables under `client_brain` (business,
audience, brand, marketing, competitors, policies, feedback) rather than one
JSON blob, so the Context Router (`docs/ARCHITECTURE.md` Section 3 /
BRD Section 7) can select only the relevant slice per AI run instead of
loading everything. Free-text fields (e.g. brand voice notes) are stored as
text; structured fields (colors, KPIs, budgets) are typed columns or
constrained JSON with a Zod schema validated on write.

## Every Metric Carries Provenance

Per BRD Section 69, every metric value stored is `{ source, retrieved_at,
period, value, unit }` — never a bare number. This is what lets the
Reporting layer avoid "Claude guesses metrics" (BRD Section 68).

## Approval Object (BRD-PRD Section 22)

```text
approval_id, organization_id, client_id, requested_by, agent_id, action_type,
risk_level, action_summary, proposed_changes, estimated_impact, status,
approved_by, approved_at, rejected_reason, expires_at
```

Status enum: `PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED | EXECUTED | FAILED`.

## AI Run Object (BRD-PRD Section 27)

```text
ai_run_id, organization_id, client_id, user_id, agent_id, model, prompt_version,
context_ids, tool_calls, input_tokens, output_tokens, estimated_cost, duration,
status, error, created_at
```

No secrets are ever stored in `context_ids`/prompt content — those reference
IDs, not raw credential values.

## Audit Event Object (BRD-PRD Section 28)

```text
audit_event_id, organization_id, client_id, user_id, agent_id, ai_run_id,
action, provider, tool, input_summary, output_summary, risk_level,
approval_id, result, error, timestamp
```

Append-only: no `UPDATE`/`DELETE` grants for the application role on
`audit_events`; only `INSERT` + `SELECT` (scoped by RBAC for read).

## Growth Map (guided onboarding wizard)

Added 2026-09-22 (see `docs/DECISIONS.md`) - an additive layer behind the
Duolingo-style guided onboarding wizard. Does not replace or restructure
the Organization→Client dashboard model above.

```text
ClientGrowthProgress:      client_id (unique), current_stage, xp, level,
                            streak_count, last_activity_at
ClientGrowthStageCompletion: client_id, stage, completed_by, completed_at
                            (one row per client per stage, unique)
GrowthMission:              key (unique), cadence [DAILY|WEEKLY], title,
                            description, xp_reward, target_count, is_active
ClientGrowthMissionProgress: client_id, mission_id, period_start,
                            progress_count, completed_at
                            (one row per client per mission per period)
ClientGrowthAchievement:    client_id, achievement_key, unlocked_at
                            (unlock event only - badge catalog is code, not DB)
```

`GrowthStageKey` is a fixed 10-value enum (`DEFINE_BUSINESS` →
`SCALE_GROW`) matching the Growth Map's path nodes. Every table carries
`organization_id` + `client_id` per the tenancy invariant above and
cascades from `Client`. "Start Mission" UI actions deep-link into the
existing screens (Audience Lab, Creative Studio, etc.) rather than
duplicating their data here.

## Next Step

Day 3 (`docs/MVP-CHECKLIST.md`) builds the tenant-scoped query helpers in
`src/lib/db/` on top of this schema, alongside auth/RBAC.
