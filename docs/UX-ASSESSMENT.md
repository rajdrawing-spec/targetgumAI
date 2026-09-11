# UX / performance assessment — 2026-09-11

Baseline audit before the "professional agency OS" upgrade. Measured on the
production build against a local Postgres 16 (so numbers isolate app work
from network latency); 47 test files / 288 tests green at this commit.

## 1. Current architecture

- Next.js 15 App Router, React 19, Tailwind, Prisma 6 + Postgres, Auth.js v5
  (JWT sessions). Everything under `/dashboard` and `/portal` is a React
  Server Component; the only client components are the sign-in form, the
  sidebar nav and the two `error.tsx` boundaries.
- 27 route files, 8 UI primitives (`badge`, `button`, `card`, `empty-state`,
  `input`, `page-header`, `trend-list`, `dashboard-nav`). No `loading.tsx`,
  no `<Suspense>`, no skeletons anywhere.
- Mutations: 27 server actions in `src/app/dashboard/actions.ts` +
  `src/app/portal/actions.ts`. Every one returns `Promise<void>`, ends in
  `revalidatePath` (3-7 paths each) and/or `redirect`. No
  `useActionState`/`useFormStatus` exists in `src/`, so no form has a pending,
  success or inline-error state; a thrown action replaces the whole page with
  the segment error card.
- Authorization is correct and centralized (`assertPermission`,
  `assertClientAccess`, `getAuthorizedClient`, `scopedClientWhere`) - every
  lib function is permission- and tenant-checked; the security suite covers
  BRD Section 80's ten scenarios.

## 2. Current client data model

`Client` = `id, organizationId, name, slug, status (ACTIVE|PAUSED|ARCHIVED),
automationLevel, createdBy, timestamps`. That is all the list page can show.
Already present and reusable: `ClientBrain` (Zod-validated JSON sections
business/audience/brand/marketing - matches BRD Section 6 field-for-field),
`ClientCompetitor`, `ClientBrandAsset`, `ClientPolicy` (BRD Section 62 fields
+ weekly automation), `ClientFeedback`, `ClientAssignment` (staff ↔ client,
no "account manager" designation), `ClientUser`, `IntegrationConnection`
(+ health/last sync/last error). Missing: legal name, website, industry
(only inside brain JSON), country/city/timezone, description, account
manager, contacts, monthly budget (only inside brain JSON), tags,
archived-at. No update/archive/delete code path exists for a client at all -
only `createClient`.

The three "LHO" rows are not seed data: `createClient` silently
auto-suffixes the slug (`lho`, `lho-2`, `lho-3`) and never checks name
uniqueness, and there is no way to archive or delete from the UI.

## 3. Current dashboard data model

Overview = 6 parallel org-wide lists (`listAccessibleClients`,
`listApprovals(PENDING)`, `listRecommendationsForOrg(HIGH, 5)`,
`listAiRuns(5)`, `listIntegrationConnectionsForOrg`, `listTasksForOrg(OPEN,
5)`), rendered as 4 count tiles + 3 cards. Counts are computed by fetching
full rows. No cross-client "attention" model, no activity feed, no upcoming
work, no per-client integration health, no performance data (no
`AnalyticsSnapshot` read path outside report generation).

## 4. Current navigation

Flat sidebar of 12 routes. Client detail is one 550-line page with ten
stacked cards (policy, 4 raw-ID integration connect forms, recommendations,
tasks, approvals, reports, AI runs, creatives, calendar, competitors) - no
tabs, no client-scoped sub-navigation, no breadcrumb context beyond a back
link. No page reads `searchParams`: there are zero filters, searches, tabs
or pagination controls in the application, although nearly every lib list
function accepts `status`/`type`/`limit` filters.

## 5. Current performance bottlenecks (measured)

Local baseline (production build, local DB, min of 3): TTFB 20-66 ms per
page, sidebar navigation 79-84 ms, open client 110 ms, create client 150 ms,
policy save 61 ms. The app is not CPU-bound; it is round-trip-bound:

| Page | SQL statements per navigation | of which auth |
|---|---|---|
| /dashboard | 20 | 14 |
| /dashboard/clients | 15 | 14 |
| /dashboard/clients/[id] | 26 | 14 |
| /dashboard/approvals | 16 | 14 |
| /dashboard/integrations | 15 | 14 |

1. **Auth resolved twice per request, uncached.** `getCurrentAuthContext`
   (`src/lib/auth/current-context.ts`) is called by the layout and again by
   every page, is not wrapped in React `cache()`, and each call is a
   sequential 7-query chain. On the deployed topology (Vercel US-East ↔
   Supabase ap-northeast-1, ~150-200 ms RTT) that is ~1-2.5 s per click
   before any page data is requested. This is the dominant cause of "feels
   slow".
2. **No loading UI** - with zero `loading.tsx`, the browser shows nothing
   until the whole RSC payload arrives; the same latency reads as "frozen".
3. **Actions with no pending state** - "Analyze this client" runs a
   multi-second Claude workflow behind a button that gives no feedback;
   create client is a redirect after a full round trip.
4. **Unbounded queries**: `listApprovals` (no `take`, no status filter -
   every historical approval is fetched forever), `listAccessibleClients`,
   `listIntegrationConnectionsForOrg`, and all three portal lists.
5. **Wrong 100 rows**: content calendar orders `publishDate asc` with
   `take 100`, so once >100 items exist the *upcoming* posts disappear.
6. Client detail fetches org-wide integration connections and filters in JS;
   approvals page fetches every full client row just to build a name map.
7. Over-invalidation: every action revalidates 3-7 routes.
8. Client-router cache for dynamic routes is 0 s (Next 15 default), so
   sidebar back-and-forth re-fetches every time.

## 6. Current broken / dead-end interactions

- Rejections write a hardcoded reason to the database (`'Rejected from
  dashboard.'`) on Recommendations, SEO, Approvals and the portal; creative
  rejection records no reason at all.
- Tasks: only OPEN→IN_PROGRESS→DONE; BLOCKED/DONE tasks show no action and
  no explanation (no reopen/unblock).
- Integrations page: shows AUTH_REQUIRED/ERROR with no reconnect/retry;
  connecting lives only on the client page, and GA4/GSC have no connect UI
  at all.
- Report "Generate client report": no idempotency, no success state, no link
  to the created report; `/dashboard/reports/[id]` throws into the error
  card on a bad id (portal twin correctly 404s); both cast `report.content`
  unchecked.
- Creatives page renders no image even when `designUrl` exists.
- Audit log has no actor or client column and no filters.
- `createContentItemAction` passes `Invalid Date` to Prisma on empty input;
  `scheduleContentItemAction` accepts unvalidated free-text networks.
- Portal renders internal workflow states (IDEA/DRAFT/IN_REVIEW) to clients
  and never confirms submitted feedback.
- No fabricated metrics anywhere (good) and no dead links (good).

## 7. Missing client-management capabilities

Edit client; archive/unarchive; delete with confirmation; contacts; account
manager; industry/website/location/timezone; tags; search/filter/sort;
sectioned onboarding; per-section editing of the Client Brain (it exists,
is used by the AI, and is invisible in the UI); competitor edit/delete;
full policy editing (only the weekly toggle is editable); per-client
integrations page with connect/test/disconnect; client settings/danger
zone; any per-client attention/activity summary.

## 8. Proposed UX improvements (in scope)

- **Feedback everywhere**: a shared `ActionResult` return type for server
  actions and `useActionState`/`useFormStatus`-based form primitives
  (pending spinner, disabled control, inline error, success message) - no
  `setTimeout`, no full-page reload; `router.refresh` only the affected
  route.
- **Skeleton `loading.tsx`** per route group; client-router `staleTimes` so
  sidebar navigation is instant on revisit.
- **Clients list** as a data-rich table (cards on small screens): industry,
  website, account manager, status, automation, connected integrations with
  health, attention counts, last activity; search + status/automation/
  manager/health filters + sort, all URL-backed (`searchParams`) with
  transitions; row actions Open/Edit/… (Archive, Delete with typed
  confirmation).
- **Add Client** as a sectioned, stepper-style form (Basic required; Contact,
  Business, Marketing, Brand, Audience, Competitors, Automation, Internal
  optional) writing to `Client`, `ClientContact`, `ClientBrain` sections,
  `ClientCompetitor`, `ClientPolicy`.
- **Client Workspace** at `/dashboard/clients/[id]` with a header and tabs:
  Overview (summary, integration health, attention, recent activity,
  upcoming), Business, Brand, Audience, Marketing, Competitors (each = one
  Client Brain section, editable independently, labeled "what the AI
  knows"), Integrations (connect/test/disconnect per provider, never
  exposing secrets), Activity (AI runs, tasks, approvals, reports, content,
  creatives), Settings (general, automation, approval policy, budget
  limits, danger zone).
- **Overview** as an operations dashboard: Attention Required across
  clients with Review/Reconnect actions, pending approvals, client activity
  feed, integration health by client, upcoming work; performance summary
  only where `AnalyticsSnapshot` rows exist, otherwise explanatory empty
  states with the connect action.
- Useful empty states (why empty + what to do + the action) and
  human-readable errors with Retry.

## 9. Proposed implementation order

1. **Phase 2 - performance and feedback** (no schema change): `cache()`d
   auth context + a leaner resolution query (14 → 6 queries/nav);
   `loading.tsx` skeletons; `staleTimes`; `ActionResult` + form primitives
   applied to every existing form; reason inputs for rejections; bounded
   queries and PENDING-first approvals; calendar ordering fix; task
   transitions; report/creative/portal fixes; Vercel `regions` co-located
   with the database.
2. **Phase 3 - Clients**: migration (`Client` profile columns, `archivedAt`,
   `accountManagerId`, `tags`; new `ClientContact`), lib functions
   (`updateClient`, `archiveClient`, `deleteClient`, contacts CRUD,
   `listClientsWithSummary`) with permission + tenant checks and tests;
   list redesign; Add Client flow; seed realism (unique sample clients, no
   metrics).
3. **Phase 4 - Client Workspace** (layout + tabs above), Client Brain
   editing, per-client Integrations and Settings.
4. **Phase 5 - Overview** redesign on the same summary queries.
5. **Phase 6 - validation**: lint, typecheck, unit/integration/security
   suites, build; new security tests for every new mutation and for
   cross-client URL access to every new client route; re-run the timing
   probe and compare with this baseline.

Authorization rules for new mutations: profile/brain/contacts/competitors/
policy edits require `clients.edit` on an authorized client; archive,
unarchive and delete require `clients.manage` (Super Admin - BRD 4.1 "Manage
clients"). Delete is a hard delete of the client and its cascaded rows;
audit events keep their history (`clientId` set null), and the action itself
is audited before it runs.
