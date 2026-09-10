# Pilot Runbook — TargetGum AI Marketing OS

BRD-PRD Section 83, Day 15: "Real client pilot." This document is what a coding
agent working autonomously **cannot** complete on its own — a real pilot needs real
credentials, a real deployed environment, and a business decision about which client
to pilot with, none of which exist in this build environment. What this document
*is*: the exact, concrete steps to run one once those three things exist, and a
faithful account of what's been verified versus what hasn't.

## What's true today (2026-09-10, end of the 15-day MVP build)

- **Code-complete and tested**: every module in `docs/MVP-CHECKLIST.md` (Days 1-15)
  is implemented, covered by the automated suite (see current count via `npm run
  test`), and passes `typecheck`/`lint`/`build`. Every day's work was also
  smoke-verified live against a real Postgres database with a real headless browser
  where a UI exists (Days 13-15).
- **Every external provider runs against mocks or injected fakes** in this
  environment: `ANTHROPIC_API_KEY`, a deployed app's own `METRICOOL_MCP_URL`/
  `METRICOOL_API_KEY`, and GA4/GSC OAuth credentials are all absent here — see
  `docs/EXTERNAL-APPROVALS.md` for the live tracker.
- **One real exception**: this *session* (not the deployed app) has its own live
  Metricool MCP connection, which was used on Day 15 to verify the Metricool
  adapter's data parsing against real API responses (not just documented schemas) —
  and that caught and fixed a real bug (`docs/INTEGRATIONS.md`). This is the closest
  thing to a "real pilot" this environment could do, and it was read-only /
  non-destructive throughout.
- **A real client and a real Metricool connection can be created through the product
  itself** as of Day 15 (`src/lib/clients/create.ts`,
  `src/lib/integrations/metricool/connect.ts`, both with dashboard forms) — this was
  a genuine gap through Day 14 (every prior `Client` row came from
  `prisma/seed.ts`/test factories) and is now closed.
- **GA4/GSC still have no connection UI** — deliberately. Both need a real Google
  Cloud OAuth app (client id/secret) and a callback route neither of which can be
  built against real credentials in this environment; a form that asks someone to
  paste a raw refresh token is the wrong pattern to build even as a stopgap
  (`docs/DECISIONS.md`).

## Prerequisites (what the user provides)

1. **Hosting**: a deployed environment per `docs/ARCHITECTURE.md` (Vercel + managed
   Postgres + Redis + object storage, or an equivalent) with its own `DATABASE_URL`,
   `NEXTAUTH_SECRET`, and encryption key configured (see `.env.example`).
2. **`ANTHROPIC_API_KEY`** — self-serve, immediate. Nothing in this build calls
   Claude without it configured (`src/lib/ai/client.ts` throws a clear
   `AiGatewayError` rather than silently degrading).
3. **`METRICOOL_MCP_URL` + `METRICOOL_API_KEY`** for the *deployed app itself* — a
   separate credential from any MCP connection available to a development session.
4. **A pilot client decision**: which real client, which Metricool brand id (from
   that brand's Metricool account settings), and — if GA4/GSC are in scope for the
   pilot — a real Google Cloud OAuth app plus the pilot client's GA4 property id and
   verified Search Console site.
5. **At least one staff account** to sign in as (Super Admin, to do the setup below;
   Account Manager/Marketing Employee accounts as needed after).

## Runbook

Once the prerequisites above are in place:

1. **Deploy** the app with the environment variables from `.env.example` filled in,
   run `npx prisma migrate deploy` against the production database, then
   `npx prisma db seed` *only* if you want the bundled demo org/users
   (`prisma/seed.ts`) — skip it for a clean production org and create the first
   Super Admin directly instead (see `prisma/seed.ts` for the exact shape if scripting
   this, or extend it with a one-off admin-creation script).
2. **Sign in** as the Super Admin.
3. **Create the pilot client**: Dashboard → Clients → "New client name" → Create
   client. This calls `createClient` (`src/lib/clients/create.ts`), which also
   creates a default `ClientPolicy` row.
4. **Connect Metricool**: on the new client's detail page, under Integrations, enter
   the client's real Metricool brand id (found in that brand's Metricool account
   settings) and an optional label, then "Connect Metricool brand". This calls
   `connectClientToMetricoolBrand` (`src/lib/integrations/metricool/connect.ts`),
   which verifies the brand id with a real `getConnectedNetworks` call before marking
   the connection `CONNECTED` — a typo'd or inaccessible brand id shows up as `ERROR`
   with Metricool's own message, not a silent no-op.
5. **Connect GA4/GSC, if in scope**: not yet a dashboard flow (see "What's true
   today" above). Until that OAuth flow is built, connect these manually:
   `connectClientToProviderAccount` + `saveProviderCredentials`
   (`src/lib/integrations/health.ts`) from a one-off authenticated script, using a
   real OAuth refresh token obtained through Google's consent flow out-of-band. This
   is the one deliberately-unfinished piece of Day 15 — build the real OAuth UI
   before running this at any scale beyond a single manually-onboarded pilot client.
6. **Set the client's policy and Client Brain**, if relevant to the pilot
   (`src/lib/clients/brain.ts` — no dashboard UI for this yet either; use the library
   functions directly from an authenticated script, or extend the dashboard with an
   edit page before the pilot if the client's context should shape the analysis).
7. **Run the analysis**: on the client's detail page, "Analyze this client". This
   runs the real `runAnalyzeClientWorkflow` (`src/lib/workflows/
   analyze-client-workflow.ts`) — Client Brain → real Metricool (and GA4/GSC, if
   connected) data → a real Claude call → findings/recommendations → routed to tasks
   or a real Approval → a generated `INTERNAL` report → an audit event, exactly as
   verified end-to-end against mocks throughout Days 9-15.
8. **Review the output** against the MVP Exit Criteria (`docs/MVP-CHECKLIST.md`'s
   list, mirrored from BRD Section 84): are findings evidence-based (cite real
   numbers from the connected providers)? Are recommendations structured and
   sensible? Did HIGH/CRITICAL items land as real Approvals, not silent actions? Does
   the Audit page (Super Admin only) show every step?
9. **Approve, reject, or action** whatever the run produced from Recommendations/
   Tasks/Approvals, and generate a `CLIENT`-facing report from the `INTERNAL` one
   ("Generate client report" on the report detail page) to see what the client would
   actually receive.
10. **Watch integration health** (`/dashboard/integrations`) over the following days
    — `lastSuccessfulSyncAt`/`lastErrorMessage` will surface any live-connectivity
    issue that mock-provider testing couldn't (the exact category of bug Day 15 found
    and fixed for Metricool's analytics parsing — GA4/GSC and the Metricool
    `campaigns` connector remain the highest-risk unverified surfaces per
    `docs/EXTERNAL-APPROVALS.md`).

## If something looks wrong

- **A report has no real numbers / recommendations look fabricated**: check
  `dataGaps` in the `INTERNAL` report and the Audit trail for `DENIED`/`FAILURE`
  events on that run first — the system is built to report gaps rather than
  fabricate (BRD Section 56), so empty findings should trace back to a specific
  disconnected/erroring integration, not silent failure.
- **A HIGH/CRITICAL recommendation appears to have executed itself**: this should be
  structurally impossible (`executeApprovedTool` only runs after a human
  `approveApproval` call) — treat it as a P0 and stop the pilot; it would mean the
  Day 10-12 approval gate has a real gap the adversarial test suite didn't catch.
- **Cross-client data appears**: same severity — stop the pilot; re-run
  `tests/security/tenant-isolation.test.ts` and
  `tests/security/adversarial-brd-section-80.test.ts` against the production
  database's actual role/permission setup, since a live misconfiguration outside the
  application code (e.g. a role's permissions edited directly in the database) could
  reproduce this even with all application-level tests passing.
