# Decisions Log — TargetGum AI Marketing OS

Architectural deviations and stack choices, with rationale, per BRD-PRD Section 125.
Newest entries at the top.

---

## 2026-09-23 — Visual consistency audit: raw Tailwind colors and leftover "terminal" theme surfaces migrated to design tokens

**Decision:** Swept the whole app for two classes of visual inconsistency and
fixed every instance found, rather than just the two pages originally
scoped (Keyword Research, Content Calendar):

1. **Raw Tailwind palette utilities** (`text-emerald-600`, `bg-rose-50`,
   `border-amber-300`, etc.) used instead of the app's semantic status
   tokens (`text-success`/`bg-success-bg`, `text-warning`/`bg-warning-bg`,
   `text-destructive`/`bg-destructive-bg`, `text-info`/`bg-info-bg`,
   `tailwind.config.ts`). These don't move with the theme system and don't
   match the brand palette - found and fixed across 10 files (Keyword
   Research being the worst, 38 instances) via
   `grep -rlE "(text|bg|border)-(emerald|indigo|rose|...)-[0-9]{2,3}"`.
2. **Un-migrated "terminal" theme components** - four components/pages
   still rendering the pre-redesign dark aesthetic (`terminal-panel`/
   `terminal-card` classes, `font-mono-data`, the `--*-hex` CSS variable
   mirrors used as literal Tailwind arbitrary values, raw `#E5252A`) instead
   of the current Card/Button/semantic-token system: `SocialCalendarHub`
   (the Content Calendar page's default view), `MarketingSearchBar` (the
   dashboard home page's primary search bar), `UniversalSearch` and
   `NotificationBell` (both in the top nav header on every page), and the
   sign-in page. All five were rewritten onto the same design system as the
   rest of the app - `Card`/`Button`/`Input`/`Textarea` primitives and
   `bg-background`/`text-foreground`/`bg-muted`/`border-border` tokens -
   with no functional changes.

Also deleted `src/components/brand-brain/brand-brain-view.tsx` - a
"terminal"-themed component with 31 raw-color instances that turned out to
be **orphaned dead code**, never imported or rendered by any route (the
real Brand tab, `clients/[clientId]/brand/page.tsx`, already covers this
data with real persistence). Reskinning an unreachable mockup would have
been wasted effort; deleting it is the correct fix.

Left `command-center-telemetry.tsx`'s `var(--text-primary-hex)` /
`var(--border-hairline)` / `var(--surface-base)` usages alone - those are
inline Recharts SVG `stroke`/`fill`/`contentStyle` props, which cannot take
Tailwind classes, and the raw-hex mirror tokens in `globals.css` exist
specifically for this case (see that file's own "Raw hex mirror of the
tokens above, for the components that use Tailwind arbitrary-value
classes... instead of the semantic classes" comment). Not debt.

**Rationale:** Direct user feedback that the app "should make sense, feel
professional and easy to use" - the two page-scoped tasks
(#30/#31 in the working punch list) undersold the actual problem: several
of the *most-visible* surfaces (the header search bar and notification
bell present on literally every page, the dashboard home page's own search
bar, the sign-in screen) were still on the old dark theme, which reads as
an unfinished, inconsistent product on first look - a bigger hit to
"professional" than any single page's styling.

**Alternative(s) considered:** Only fixing the two originally-scoped pages
- rejected once the header components turned out to still be un-migrated;
leaving them dark-themed while the rest of the app is light-themed would
have been a more jarring inconsistency than either theme alone. Reskinning
`BrandBrainView` instead of deleting it - rejected after confirming via
`grep` that nothing imports it; effort spent polishing unreachable code is
effort not available for surfaces users actually see.

**Revisit if:** A future visual pass wants to re-introduce a "terminal"/
dense-data aesthetic deliberately (e.g. for a power-user analytics view) -
at that point it should be a named third variant in the design system, not
a leftover from before the Duolingo-style redesign.

---

## 2026-09-23 — Growth Map content rewritten for a zero-marketing-background persona; Stage 1 becomes a plain-language intake form

**Decision:** The Growth Map's lesson content and Stage 1 mechanic are
rebuilt around a "someone who has never done any marketing" persona - the
running example is a small independent maker (a potter selling handmade
goods), not a marketing professional. Two changes:

1. `src/lib/growth/lesson-defs.ts`'s 36 quiz questions across the 9
   quiz-based stages (everything except `DEFINE_BUSINESS`) are rewritten in
   plain, everyday language. No jargon anywhere - no "value proposition",
   "ICP", "ROAS", "CTR", "funnel", "A/B test", "LTV:CAC", "SMART goals",
   "negative keywords", etc. Every question and explanation uses a concrete,
   relatable example from a small handmade-goods business. `LESSON_DEFS`
   changed from `Record<GrowthStageKey, LessonDef>` to
   `Partial<Record<...>>` and `getLessonForStage` now returns
   `LessonDef | undefined`, since `DEFINE_BUSINESS` has no quiz entry at
   all.
2. Stage 1 ("Define Your Business") is no longer a quiz. It's a new
   component, `BusinessIntakeForm` (`src/components/growth/business-intake-
   form.tsx`), rendered by a branch in `growth/lesson/[stage]/page.tsx`: four
   plain-language questions ("What do you make or sell?", "What makes your
   work special?", "Where do people buy from you?", "What would you like
   this to help you achieve?"), each with a short concrete example, that
   write straight into the Client Brain's existing `business` section via a
   new `completeBusinessIntakeAction`. Someone brand new to their own
   business page shouldn't be quizzed on marketing terms before they've even
   described what they make.

The intake form is not a one-time gate the way the quiz stages are: since a
business's own description of itself can change, the form stays open and
resubmittable after Stage 1 is marked complete (shown as a "Saved - you can
update this anytime" badge instead of being replaced by a read-only summary).
`completeBusinessIntakeAction` only calls `completeStage` while
`DEFINE_BUSINESS` is still the client's *current* stage (checked via
`getStageStates`, matching how `completeStage` itself enforces one-stage-at-
a-time); resubmitting later just updates the Brain section without trying
to re-complete a stage that's already moved past.

**Rationale:** Direct user feedback via a "village potter" persona
description: the target user for this app has no digital marketing
background at all - a small manufacturer or craftsperson with a unique
product and no budget for a marketing agency. An app whose very first
screen quizzes that person on terms like "value proposition" or "ideal
customer profile" fails its actual audience before it's taught them
anything. The fix has to be content-and-interaction-model, not visual:
rewriting words in the existing quiz UI wasn't enough for Stage 1
specifically, because a form (not a quiz) is the right mechanic for
"describe your own business" - there's no right/wrong answer to grade, and
the data needs to persist as structured Brain fields the AI Gateway reads,
not just XP.

**Alternative(s) considered:** Keeping `DEFINE_BUSINESS` as a quiz but
simplifying its wording - rejected, since the user's own words were "we
need to understand about his business and his basic info" first, which is
fundamentally a data-collection step, not a knowledge check. A brand-new
Client Brain data model specific to onboarding - rejected in favor of
writing into the existing `business` Brain section directly, since that's
already the exact data the Business tab and AI Gateway read; a parallel
"onboarding answers" store would just need reconciling with it later.
Gating the intake form as one-time-only (like the quiz stages) - rejected,
since a business profile is exactly the kind of thing that should stay
editable, and the Business tab already allows this; matching that instead
of introducing a special "locked after first save" state keeps the two
surfaces consistent.

**Revisit if:** Client feedback surfaces specific words or examples in the
rewritten lesson content that still read as jargon to a first-time user, or
if agencies managing more sophisticated clients ask for a way to skip the
plain-language framing (at that point, a client-type flag on the
persona/tone rather than two parallel content sets is the more scalable
fix).

---

## 2026-09-23 — Growth Map path back to one full node per stage, phase banners as dividers

**Decision:** `GrowthRoadmap` (renamed from `PhaseRoadmap`) goes back to
rendering all 10 stages individually - number, title, description, and
action (Start Mission / Review / locked), matching the approved reference
mockup exactly - instead of the previous round's 4 phase-summary nodes.
Phases are now section dividers: a colored "PHASE N OF 4 · Title" banner
is inserted into the path before that phase's first stage, the same idea
as a real Duolingo unit banner, rather than a container that swallows its
stages' own detail. Still one narrow, centered layout at every viewport
width (no `sm:` branching) and still has the hover/press micro-animations,
glow-pulse and "Continue" callout from the previous round.

**Rationale:** Direct feedback, again with the reference mockup attached:
"where is that stages one? like duolingo" - the phase-summary version had
traded away the individual stage detail (title + description + own node
per stage) the reference image shows for every one of the 10 stages. The
phase concept itself (multiple steps grouped under a named phase) was
never in question; what was missing was the per-stage detail within each
phase.

**A real overlap bug found and fixed, the hard way:** the first pass at
this version budgeted each stage's vertical slot from estimated per-line
heights (title/description/action), and the very first live screenshot
showed banners overlapping the previous stage's text - the exact bug this
layout hit before (docs/DECISIONS.md, "Growth Map path unified...").
Bumping the constants didn't visibly move the overlap in the next
screenshot, which looked like the fix wasn't taking effect - a `rm -rf
.next` + fresh dev server ruled out a stale build. What actually resolved
it was abandoning eyeballed screenshots entirely for the last mile:
`page.evaluate(() => el.getBoundingClientRect())` on every path item,
sorted top-to-bottom, reporting the real gap between each consecutive
pair. That immediately showed the true (small, ~4-9px) overlap and which
specific pair caused it, rather than continuing to guess at CSS pixel
budgets from a compressed screenshot. Re-verified after the fix: every
one of the 13 consecutive gaps on the page measured positive.

**Alternative(s) considered:** None - this is a return to the earlier
per-stage approach with the improved narrow/unified layout mechanics kept.

**Revisit if:** Any future spacing change to this component should be
confirmed the same way - measured `getBoundingClientRect()` gaps, not a
screenshot read by eye - given how easy it was to misjudge "did this
change do anything" from a compressed image.

---

## 2026-09-23 — Left sidebar removed; navigation moved to a 4-item top bar with dropdowns

**Decision:** `src/components/dashboard-nav.tsx`'s old flat 18-item sidebar
list is gone, along with the sidebar `<aside>`, its off-canvas mobile
drawer, and its collapsible-column checkbox toggle in
`src/app/dashboard/layout.tsx`. Navigation now lives entirely in the top
bar: two direct links (**Command Center**, **Clients** - the two used
constantly) plus two dropdown tabs (**Campaigns**: AI Ad Campaigns,
Social Hub, Creative Studio, Keyword Research, SEO Intelligence;
**Insights**: Unified Telemetry, Performance Reports, Recommendations,
Action Items, Approvals Gate, AI Engine Runs, Ledger & Audit). The three
account/org-scoped pages that lived in the sidebar's footer (Team,
Integrations, My Account) moved into a new avatar `AccountMenu`, next to
Sign out - the standard home for that kind of page once there's no
sidebar to anchor a footer to. Below `lg`, `TopNav` hides and a
`MobileMenu` hamburger opens the same grouped data as a dropdown panel
(with the header's search bar, which itself hides below `xl` for room,
folded in above the links) - one data source (`NAV_DIRECT`/`NAV_GROUPS`)
drives both. `universal-search.tsx`'s existing `NAV_ITEMS` import still
works unchanged - it's now a flattened view over the same groups.

**Rationale:** Direct request: "there should be no left bar. it should be
moved to top bar with proper segregations. in 3-4 tabs with dropdown." 18
flat items were also genuinely more than a sidebar could present cleanly;
grouping them under Campaigns/Insights is real categorization, not just a
container change. The two dropdowns (`NavDropdown`, reused for
`AccountMenu`) are click-to-open with outside-click/Escape-to-close and a
fade/scale transition rather than a `<details>` disclosure - a floating
menu that has to dismiss itself on an outside click needs that, unlike
the Growth Map's inline expand/collapse sections which stayed native
`<details>`.

**Alternative(s) considered:** Keeping Notifications as a full nav item -
dropped in favor of the existing `NotificationBell` header dropdown, which
already links to `/dashboard/notifications` ("View all"), so the page
stays reachable without a redundant top-level entry. A mega-menu showing
every group at once - rejected as more visual weight than two short
dropdowns for the same 12 grouped items.

**Revisit if:** The Campaigns or Insights group grows enough that a
5-item or 7-item dropdown stops being scannable at a glance - that's a
signal to split further rather than let one dropdown keep growing.

---

## 2026-09-23 — Growth Map path unified to one narrow layout for mobile and desktop

**Decision:** `PhaseRoadmap` is now a single `max-w-xs` (320px) centered
path used at every viewport width, replacing the previous two-layout split
(a wide `sm:`-only illustrated path with side-anchored text, plus a
separate collapsible-list fallback below `sm`). A red "PHASE N OF 4"
banner (mimicking real Duolingo's colored unit bar) sits above the path
and names the client's current phase; each phase node's caption and stage
list are centered directly under the node instead of anchored left/right,
which is what let one layout serve both breakpoints - anchoring only
mattered when the label had to dodge the node depending on which side of
a *wide* zigzag it fell on. Interactive nodes get a hover/press scale
transition, the current node keeps its glow-pulse ring plus a small
speech-bubble "Continue" callout, and each node fades/slides in on load
(staggered by index) via a new `fade-in-up` Tailwind animation.

**Rationale:** Direct feedback, with real Duolingo screenshots attached
for comparison: the previous version's wide zigzag with side-anchored
paragraph labels didn't read as authentically Duolingo-style, and needing
a structurally different mobile layout contradicted "it should be the
same in mobile and desktop." Duolingo's own path is in fact narrow and
mostly-centered even on desktop (it just sits inside a wider page with
more chrome around it) - matching that shape is what makes one layout
correct at any width, not a breakpoint trick.

**A real spacing bug found and fixed in the same pass:** the first version
of this layout sized each phase node's vertical slot from `NODE_D +
CAPTION_H + rows` without enough headroom for a caption that reliably
wraps to two lines ("Phase 4 · Optimize & Grow" at 152px) or for the
"Continue" callout's extra height on the current phase - both are visible
DOM content but weren't part of the reserved-height math, so the trophy
at the bottom overlapped the last phase's stage list. Fixed by sizing
`CAPTION_H` for two lines and adding a `CONTINUE_BUBBLE_H` allowance only
for the current phase, confirmed by measuring the rendered page via
Playwright rather than eyeballing the arithmetic.

**Alternative(s) considered:** Keeping the wide zigzag and just also
applying it below `sm` with smaller side margins - rejected; a wide
side-anchored layout genuinely cannot fit a phone screen without breaking,
which is why the split existed in the first place. A JS-measured/animated
accordion for per-phase detail - rejected in favor of always-visible
compact stage rows, avoiding a repeat of the collapsible-list version's
"too long" feedback and keeping the page server-rendered with no client
component.

**Revisit if:** A 5th phase, or stage counts per phase growing past 3,
changes the block-height arithmetic enough that the fixed constants need
retuning again - re-verify by rendering and screenshotting rather than
adjusting the numbers blind.

---

## 2026-09-23 — Growth Map restructured into 4 phases, illustrated winding path dropped

**Decision:** The 10 fixed stages are now grouped into 4 named phases
(Foundation, Build, Launch, Optimize & Grow - `src/lib/growth/phase-defs.ts`)
rendered as a short `Phase 1 -> 2 -> 3 -> 4` stepper plus a list of
collapsible `<details>` sections, one per phase, each listing its 2-3
stages as a compact row (status icon, title, one-line description, action).
Only the phase holding the client's current stage opens by default. The
illustrated winding SVG path, decorative scenery (`scenery.tsx`, deleted -
nothing else referenced it), and the separate desktop/mobile layout split
are all gone; one compact list now serves both.

**Rationale:** Direct user feedback on the shipped illustrated map - "too
long," wanted something "short and like in stages... Stage 1 or phase 1
kind of." The full 10-stage path was ~2000px of scroll on its own before
missions/achievements even started. Grouping is a pure display layer
(`phaseStatus()` derives phase status from the existing per-stage
`getStageStates()` output) - no schema change, no migration; stage
order/completion/XP logic in `stages.ts` is untouched.

**Alternative(s) considered:** Keeping the illustrated path but just
shrinking its spacing - rejected because the user's ask was explicitly
"like in stages," not just shorter; a compact phase list matches that
literally and reads better on mobile too (no more separate `PlainStageList`
fallback needed). A client-side accordion (React state) - rejected in favor
of native `<details>/<summary>` with `open` set server-side per phase
status, since it needs no JS and nothing here requires syncing collapse
state across renders.

**Revisit if:** A 5th phase or a re-grouping of which stages belong to
which phase is needed - `GROWTH_PHASE_DEFS` is the one place that changes;
stage order and count stay the source of truth in `stage-defs.ts`.

---

## 2026-09-22 — Growth Map stage completion moved behind a mascot-hosted lesson/quiz, no new tables

**Decision:** Each of the 10 Growth Map stages now has a short Duolingo-style
lesson (`src/lib/growth/lesson-defs.ts`) - 4 multiple-choice questions with
instant right/wrong feedback and an explanation, reached via a new route
(`.../growth/lesson/[stage]`). The one-click "Complete stage" button is gone;
`completeStage`/`completeStageAction` (unchanged - same permission check,
tenant check, and in-order enforcement as before) is now only reachable from
a lesson's "Claim XP & complete stage" button. A lesson is always
completable - there's no pass/fail gate blocking progress, since this is
self-directed onboarding, not a graded exam; right/wrong feedback is for the
learning value and the Duolingo feel.

**Rationale:** Lesson content (questions, options, correct answer,
explanation) is fixed editorial copy written for this app, not client or
provider data, so it lives in code the same way `stage-defs.ts` and the
achievement catalog already do - no new Prisma model or migration needed.
Stage completion state is exactly what `client_growth_stage_completions`
already tracked; the lesson is a new UI/interaction layer in front of an
existing, already-tested mutation, not a new one.

**A real bug found and fixed along the way:** the lesson page's "Claim XP"
button is an `ActionForm` whose `redirectTo` effect calls `router.push()` on
success. Next.js also auto-refreshes the *current* route's Server Component
data the instant a Server Action resolves - which here flips
`alreadyCompleted` to `true` and swaps the `ActionForm` out for a plain
"Back to map" link before the form's own pending `router.push()` gets a
chance to fire, silently dropping the redirect (confirmed via a Playwright
run: the URL never left the lesson page even though the claim itself
succeeded). Fixed by freezing the "can still claim" decision and the bound
action reference in `useState(() => ...)` on first render inside
`LessonQuiz`, so a mid-flight server refresh can't rip the form out from
under its own pending navigation.

**Alternative(s) considered:** A new `ClientGrowthLessonAttempt` table to
record per-attempt score/history - rejected for this increment since nothing
in the product yet reads "how many times did they retry" or "what was their
score history"; the map only needs "is this stage done", which the existing
completion table covers. Can be added later if attempt analytics become a
real requirement. Gating stage progress on a passing score - rejected as
unnecessary friction for self-directed onboarding content.

**Revisit if:** Lesson content needs to be editable by agency admins rather
than fixed per-app copy (would need a real table + editor, not a TS file),
or per-attempt analytics become a real requirement.

---

## 2026-09-22 — Growth Map schema is additive, not a nav restructure

**Decision:** Added five new tables (`client_growth_progress`,
`client_growth_stage_completions`, `growth_missions`,
`client_growth_mission_progress`, `client_growth_achievements`) plus
`GrowthStageKey`/`GrowthMissionCadence` enums, backing a new Duolingo-style
guided-onboarding wizard. No existing table was altered; `Client` only
gained four new back-relations. The wizard is a separate route that funnels
into the existing Client Workspace on completion - it does not replace the
Organization→Client dashboard/nav, and Recommendation/Task/Approval flows
are untouched.

**Rationale:** The wizard's "Start Mission" buttons deep-link into real
existing screens (Audience Lab, Creative Studio, etc.) rather than
duplicating them, so no new tables were needed for the underlying work
itself - only for tracking progress through the map (XP/level/streak per
client, which of the 10 fixed stages are done, and daily/weekly mission
completion). Stage history is a separate append-style table
(`client_growth_stage_completions`) rather than an array column on
`client_growth_progress`, matching this schema's existing normalized-child-
table pattern (e.g. `ClientContact`, `ClientAssignment`) and so streak/
achievement logic can query "when was each stage completed" directly.
Achievement *definitions* (icon, color, unlock rule) live in application
code keyed by `achievementKey`, not a new table - the catalog is a fixed
handful of badges, not per-organization content; only the unlock event is
persisted.

**Alternative(s) considered:** Restructuring the whole app's navigation
around the Growth Map (rejected per user direction - keep the existing
dashboard, add this as an additive onboarding layer, see this file's
"Where to look" table and CLAUDE.md rule 1's unrelated-features guard).
Storing per-stage completion as a `GrowthStageKey[]` array on
`client_growth_progress` instead of a child table - rejected because it
loses `completedAt`/`completedBy` per stage, which the streak calculation
and audit trail both need.

**Revisit if:** The onboarding wizard's stage-to-feature mapping (which
real screen each of the 10 stages deep-links to) turns out to need
per-organization customization rather than one fixed sequence - at that
point `GrowthStageKey` stops being a good fit as a fixed enum.

---

## 2026-09-14 — Amazon Ads adapter built from scratch (Phase 2 of the Full Automation Roadmap)

**Decision:** `src/lib/integrations/amazon-ads/` is a brand-new integration
module - no adapter of any kind existed for Amazon Ads before this (the
9-13 audit flagged it as "no adapter directory exists"). Scoped to
**Sponsored Products only** - the highest-volume Amazon ad type, and the
one `src/lib/ads/types.ts`'s `CreateCampaignInput` already has fields for
(`AmazonCampaignType`, `AmazonTargetingType`). Sponsored Brands/Display
would be additional, near-identical adapters, not a rewrite of this one,
if ever needed. Same "not live-verified" situation as Google Ads: no
Amazon Advertising API access application/Login with Amazon (LWA) app/
test advertiser account exists in this environment
(docs/EXTERNAL-APPROVALS.md), so every request/response shape follows
Amazon's published REST reference as closely as training data allows and
is verified in tests against that exact shape
(`tests/unit/native-ads-providers.test.ts`), not against Amazon's actual
infrastructure.

**Structure mirrors `google-ads/` exactly** (`amazon-ads-client.ts`,
`provider.ts`, `mock-provider.ts`, `index.ts`, `tools.ts`, `connect.ts`,
`README.md`) - same reasons: no official Node.js client exists for the
Amazon Advertising API either, and the auth model is agency-wide (one
Login with Amazon refresh token acts on any advertiser profile shared
with the agency's Amazon account, identified per call by its numeric
profile id - `IntegrationConnection.externalAccountId`), so
`createAmazonAdsProvider(accountId?)` takes the profile id as a factory
argument the same way Google Ads' does, for the same reason (every Amazon
Ads API call is scoped to a profile via the
`Amazon-Advertising-API-Scope` header; the shared `AdsProvider`
interface's write methods carry no account-id parameter).

**The one genuinely different piece: performance data is asynchronous.**
Unlike Meta and Google Ads, Amazon has no synchronous "get today's stats"
endpoint for Sponsored Products - `getCampaignPerformance` has to request
a report, poll until Amazon finishes generating it, then download and
gunzip the result. Implemented as a bounded poll (10 attempts, 3s apart,
~30s total) rather than blocking indefinitely; a report still pending
after that throws a clear error instead of returning partial or
fabricated data (CLAUDE.md rule 5) - proven with a test that forces the
poll to never complete. In production this may need to move off a
user-facing request path entirely (the scheduled worker, Full Automation
Roadmap §4 phase 9) rather than growing the bound further.

**Three follow-on extensions made while wiring this up, all small because
the patterns already existed:**
- `src/lib/ads/service.ts`'s `toggleCampaignStatus` (built for Meta,
  already generalized to a provider→tool-key map when Google Ads was
  added) got Amazon Ads as a third entry - the Ads Hub's real-pause/
  approval-gated-resume behavior now covers every `AdPlatform` with one
  shared code path, not three parallel ones.
- The Marketing Analytics Agent (`src/lib/agents/analytics-agent.ts`) now
  reads Google Ads and Amazon Ads campaigns/performance too, not just
  Meta - "analyze this client" was silently Meta-only for ads despite
  Google Ads already being real since Phase 1; both are now in its
  allowlist and its data-gathering sequence, same `tryGatherData` pattern
  as every other source (a failure becomes a reported gap, never a
  fabricated value).
- Fixed the 3 pre-existing stale assertions in
  `tests/integration/analytics-agent.test.ts` flagged in the original
  audit (allowlist/dataGaps counts hadn't been updated when Meta Ads was
  added to the agent in an earlier session) while touching this file for
  the Google Ads/Amazon Ads additions anyway - connected all three ad
  platforms for the "full pipeline" test client (Google/Amazon succeed via
  their mocks; Meta has no mock fallback and genuinely needs
  `META_ACCESS_TOKEN`, so its 2 tool calls are asserted as the only
  expected gaps, rather than papering over that distinction).

**A real gap closed, not just the adapter:** the client Integrations tab
had connect forms for Metricool, Google Ads, Meta Ads, and Canva - never
Amazon Ads, even though the Connections tab's ad-platform row already
listed it with a "Manage on Integrations tab" link that went nowhere
useful. Added a matching form (same pattern as Google Ads' - one text
input for the advertiser profile id, `connectAmazonAdsAccountAction`
reusing the same generic `connectAction` helper every other provider's
button already uses) so this adapter is actually reachable, not just
real-but-unusable. Verified live against a production build: connect via
the form → shows CONNECTED → Activate a paused campaign on the Ads Hub →
creates a real HIGH-risk approval, shown on the Approvals Gate as "Update
an Amazon Ads campaign" → same pending-approval pill Meta/Google Ads use.

**One casing inconsistency found and deliberately left as-is, not
papered over with a normalization layer:** Amazon's native campaign
states are lowercase (`"paused"`/`"enabled"`), while Meta's are uppercase
(`"ACTIVE"`/`"PAUSED"`) and Google's are also uppercase but a different
word (`"ENABLED"`/`"PAUSED"`) - every adapter already passes through its
platform's native status string rather than normalizing to one shared
vocabulary, so this is one more instance of an existing pattern, not a
new inconsistency. The one place it mattered was test assertions written
assuming uppercase (`tests/integration/native-ads-tools.test.ts`'s
provider-parametrized suite) - made those two assertions
case-insensitive rather than either normalizing Amazon's adapter output
or excluding Amazon from that shared test file.

---

## 2026-09-14 — Google Ads adapter implemented for real (Phase 1 of the Full Automation Roadmap)

**Decision:** `src/lib/integrations/google-ads/provider.ts` no longer
throws `UnsupportedOperationError` for every method. It's now a real
adapter against the Google Ads API (v18, REST + GAQL,
`google-ads-client.ts`) - the same choice already made for Meta Ads
(2026-09-13), and for the same reason it wasn't done earlier: there is no
official Node.js client library for the Google Ads API at all (Google's
own client-library list covers Java/.NET/PHP/Python/Perl/Ruby, not Node),
so the only way to implement this at all is against the documented REST
interface directly. This environment still has no `GOOGLE_ADS_DEVELOPER_TOKEN`/
OAuth client/test account (docs/EXTERNAL-APPROVALS.md), so every request/
response shape follows Google's published reference as closely as
training data allows and is verified in tests against that exact shape
(`tests/unit/native-ads-providers.test.ts`) - not the same thing as
confirming it against Google's actual infrastructure. Two spots are
flagged inline in `google-ads-client.ts` as most likely to need a one-line
fix once real credentials exist: the `updateMask` casing convention on
mutate operations, and whether a fresh `SEARCH` campaign needs an explicit
`networkSettings` block to pass validation.

**What's implemented:** all nine `AdsProvider` methods - GAQL search for
`getCampaigns`/`getCampaignPerformance`/`getAdGroups`/`getAds`; a two-step
`campaignBudgets:mutate` + `campaigns:mutate` for `createCampaign` (always
`PAUSED`, same convention as Meta's `createMetaCampaign` and BRD Section
21's "create draft campaign is MEDIUM, launch is a separate HIGH action");
`campaigns:mutate` for pause/resume; a budget-resource lookup +
`campaignBudgets:mutate` for `updateBudget` (Google Ads budgets are a
separate resource from the campaign, unlike Meta's inline `daily_budget`);
`adGroups:mutate` for `updateBid` (Google Ads sets bids at the ad group
level, never per-ad - `providerAdId` is treated as an ad group id, noted
in both `provider.ts` and the tool's own description in `tools.ts`).

**A real interface gap found and fixed along the way:** the shared
`AdsProvider` interface's four write methods
(`updateCampaign`/`pauseCampaign`/`updateBudget`/`updateBid`) don't carry
an account id parameter - Meta never needed one (a Graph API campaign id
is globally addressable), so this was never noticed. Every Google Ads API
call is scoped to a customer account in the URL path itself
(`/customers/{id}/...`), so without one these four methods are
unreachable for Google Ads specifically. Rather than widen the shared
interface (which would ripple into Meta's and Metricool's implementations
and every existing test for both, for a parameter neither needs),
`createGoogleAdsProvider(accountId?)` takes it as a factory argument
instead - the same shape Meta's own `createMetaAdsProvider(token)` already
uses for its per-call context. `google-ads/tools.ts`'s four write tools
now pass `connection.integrationAccount.externalAccountId` when they build
the provider (previously they ignored the `connection` argument
`withIntegrationHealthTracking` already handed them, since the mock
provider never needed it either).

**Ads Hub pause/resume toggle extended to Google Ads.** The real-pause/
approval-gated-resume behavior built for Meta Ads campaigns (2026-09-14,
below) now applies identically to Google Ads campaigns -
`toggleCampaignStatus` (`src/lib/ads/service.ts`) looks up a
`{pause, resume}` tool-key pair per provider (`REAL_PAUSE_RESUME_TOOLS`)
instead of a Meta-specific branch, so a third real adapter (Amazon Ads,
when built) is a one-line addition to that map, not a new code path.
Verified live against a production build with the same click-through as
Meta's resume feature: Activate on a paused Google Ads campaign creates a
real `google_ads.update_campaign` approval (HIGH risk, shown on the
Approvals Gate as "Update a Google Ads campaign") and switches the row to
the same "Pending approval" pill Meta's resume uses - no UI code changed,
since that pill was already built provider-agnostic.

**Auth model, documented for the first time:** unlike Meta's per-connection
encrypted token, Google Ads authenticates once per *manager* (MCC)
account - a single agency-wide OAuth refresh token
(`GOOGLE_ADS_REFRESH_TOKEN` + `GOOGLE_ADS_LOGIN_CUSTOMER_ID`) can act on
any client account linked under that manager, identified per call by the
client's own customer id (`IntegrationConnection.externalAccountId`).
Added a "Native Ads" section to `.env.example` documenting every Meta and
Google Ads environment variable the code reads - neither provider had one
before this, despite `META_ACCESS_TOKEN` already being read in production.

---

## 2026-09-14 — Ads Hub "Resume" now goes through the Approval Engine, with a pending-approval UI

**Decision:** the previous pass (2026-09-13, below) deliberately left resuming
a paused META_ADS campaign as a local-only status change, because doing it
for real meant routing through the HIGH-risk, approval-gated
`meta_ads.update_campaign` tool - which can't resolve synchronously inside
a one-click toggle, and building the pending-approval UI was explicitly out
of scope for that pass ("dont chagne the UI"). Asked to build exactly that
next, so this pass adds it.

**Schema:** `Campaign.approvalId String?` (migration
`20260914170901_add_campaign_approval_id`), mirroring
`ContentCalendarItem.approvalId` - same one-column, one-purpose shape, no
new join table.

**Flow (`toggleCampaignStatus`, src/lib/ads/service.ts):** clicking
"Activate" on a connected Meta campaign calls `meta_ads.update_campaign`
with `status: 'ACTIVE'`. That's HIGH risk, so it never executes on this
call - `executeTool` creates a PENDING `Approval` and throws
`ApprovalRequiredError`, which is caught to record the approval id on the
campaign; `status` stays `PAUSED`. Calling it again while one is already
pending is refused outright (`"A resume request is already pending
approval for this campaign."`), not a second approval. Once a human
approves or rejects it on the Approvals Gate, `syncCampaignFromApproval`
(called from `approveApprovalAction`/`rejectApprovalAction`, same pattern
as `syncContentCalendarItemFromApproval`) reconciles the row: EXECUTED ->
`status: ACTIVE`, `approvalId: null`; FAILED/REJECTED/EXPIRED/CANCELLED ->
`approvalId: null` only, leaving it `PAUSED` and retriable.

**Bug found and fixed along the way:** `meta-ads/provider.ts`'s
`updateCampaign` only ever sent `status=PAUSED` to the Graph API - there
was no branch for `status=ACTIVE` at all, so even an approved-and-executed
resume would have flipped TargetGum's own status to `ACTIVE` without ever
telling Meta. Added `resumeMetaCampaign` (`meta-ads/meta-client.ts`, POSTs
`status=ACTIVE`) and wired it in. Caught by a unit test
(`tests/unit/native-ads-providers.test.ts`) asserting the exact request
Meta receives, and an integration test
(`tests/integration/toggle-campaign-status.test.ts`) that approves a real
pending resume with a mocked Graph API and checks `fetch` was actually
called - exactly the kind of gap this session's earlier audit was written
to catch.

**UI (src/app/dashboard/ads/page.tsx):** a campaign with a pending
`approvalId` shows an amber "Pending approval" pill and a "Review on
Approvals Gate →" link in place of the Pause/Activate button - same visual
language the content-calendar list view already uses for its own pending
publish requests (`"Publish requested - awaiting approval on Approvals
Gate"`), not a new pattern invented for this one screen. Verified live
against a production build: clicking Activate creates the approval and
switches the row to the pending state; rejecting it on the Approvals Gate
clears `approvalId` and the row goes back to a plain "Activate" button,
retriable.

---

## 2026-09-13 — Feature audit follow-up: fix Settings crash, real Meta Ads create/pause, no UI changes

**Context:** the same-day feature audit (see the published report this
session's summary references) flagged P0-4 (the Client Settings page
crashes in a production build) and P1-6 (the Ads Hub pause toggle only
edited TargetGum's database, never Meta). The user asked to continue but
explicitly said not to change the UI - scoped afterward to: fix bugs and
wire real backend logic behind the *existing* buttons/screens, without
redesigning or relabeling anything.

**P0-4 fix:** `ConfirmDialog`'s `trigger` render-prop was defined inline in
`src/app/dashboard/clients/[clientId]/settings/page.tsx`, a Server
Component - Next.js forbids passing a plain function (as opposed to a
Server Action) across the server/client boundary, which crashed the page
in `next build && next start` while working fine under `next dev` (the
boundary isn't enforced there), hiding the bug until now. Fixed by moving
the three Danger Zone triggers into a new client component
(`src/components/clients/danger-zone-actions.tsx`) that creates the
closures client-side; the bound Server Actions (`archiveClientAction.bind(...)`
etc.) still pass through as props unchanged - only they're allowed to cross
that boundary. Markup/classes are byte-for-byte what they replaced -
verified by screenshot diff against the pre-fix page.

**Meta Ads `create_campaign` implemented for real:** `meta-ads/provider.ts`'s
`createCampaign` threw `UnsupportedOperationError` and pointed users at the
(non-functional) AI Ad Studio; `tests/integration/native-ads-tools.test.ts`
already specified the intended contract (creates a real, `PAUSED` campaign)
for both providers under `describe.each`, so Meta was the only one not
meeting its own test's intent. Added `createMetaCampaign` to
`meta-ads/meta-client.ts` - a real `POST /act_X/campaigns` - always
`status: PAUSED` (BRD Section 21: creating is MEDIUM/automatic, launching
is a separate HIGH/approval-gated `update_campaign` call, unchanged).
Defaults `objective` to `OUTCOME_TRAFFIC` and `special_ad_categories` to
`[]` since nothing upstream collects either yet; regulated categories
(housing/credit/employment/politics) are out of scope until a real intake
exists for them. Verified with a fetch-mocking unit test
(`tests/unit/native-ads-providers.test.ts`) asserting the exact request
body, since this environment has no live `META_ACCESS_TOKEN` to test
against Meta itself - the 3 pre-existing `native-ads-tools.test.ts` Meta
failures remain (they need real credentials, not this code) and are
otherwise unaffected.

**Ads Hub pause toggle now calls the real Graph API - resume does not, yet:**
`toggleCampaignStatus` (`src/lib/ads/service.ts`) previously flipped only
the local `Campaign.status` column for every provider and direction. Now,
pausing a connected `META_ADS` campaign calls `meta_ads.pause_campaign`
(MEDIUM risk, executes immediately, no approval) before the local row
updates, and a failed call leaves the row untouched rather than silently
reporting success. **Resuming stays local-only**, deliberately: BRD
Section 21 rates re-activating a campaign like "launch campaign" - HIGH
risk, approval-required - and an approval can't resolve synchronously
inside a one-click toggle without a pending-approval affordance on this
button, which is a UI change outside this pass's scope. Non-Meta providers
are unaffected (no write adapter exists for Google/Amazon Ads yet).
Covered by `tests/integration/toggle-campaign-status.test.ts` (real-call
success, failure doesn't fake-succeed, resume/non-Meta stay local-only).

**Deliberately not done in this pass** (still true after this commit, and
still the accurate self-assessment vs. the audit): "Launch Ad Set" (`/dashboard/
ads/new`) still creates a local-only DB row; the AI Ad Studio still fakes
generation/staging; Metricool post scheduling/publishing is still mock/stub;
weekly automation still only enqueues into an undeployed worker; automation
levels/policies still don't gate anything but the weekly toggle. Each needs
either a UI decision (approval/pending states, "not connected" states) or
more work than fits one pass - see the audit report for the prioritized list.

---

## 2026-09-13 — Client Workspace "Connections" tab: structure before API (explicit user request)

**Decision:** New `/dashboard/clients/[clientId]/connections` tab listing
every social/web platform a client might be on - Web, Blog, Facebook,
Instagram, Threads, X, Bluesky, LinkedIn, Pinterest, TikTok (personal +
business), Google Business Profile - plus a read-only view of the existing
ad platforms (Meta Ads, Google Ads, Amazon Ads, TikTok Ads). Connecting a
social/web platform today just records a handle/page name as a label - no
real API or OAuth behind any of them yet, exactly as asked ("later i will
do api things, first build the structure"). Reuses the existing
`Integration`/`IntegrationAccount`/`IntegrationConnection` tables (11 new
`IntegrationProvider` enum values; `LINKEDIN` already existed and is
reused) rather than a parallel schema - same tenant scoping, health
tracking, and RBAC gate (`integrations.manage`) as every other provider.

**Ad platforms are read-only here, not connectable.** Meta Ads and Google
Ads already have real connect flows on the Integrations tab
(`connectClientToMetaAdsAccount` etc. - live-verified in an earlier
session). `src/lib/integrations/connections.ts`'s `assertConnectable`
refuses METRICOOL/CANVA/GA4/GOOGLE_SEARCH_CONSOLE/GOOGLE_ADS/META_ADS
outright - this new simpler "just a label" path can never touch a
provider with a real credentialed connection elsewhere, so there is no way
for the new tab to silently clobber a working connection. The Connections
tab links to the Integrations tab for those instead of duplicating a
second, weaker connect form for the same provider.

**Placement:** a new tab (not folded into the existing Integrations tab)
per explicit user choice - Integrations stays scoped to business-tool
integrations (Metricool/Google Ads/Meta Ads/Canva); Connections is the
client's platform/account inventory, modeled after Metricool's own
"Connections" settings screen the user referenced directly.

**Trade-off accepted:** a connected placeholder proves nothing - no
verification is possible without a real provider behind it, so `CONNECTED`
here means "someone recorded this account exists," not "we can read or
post to it." Acceptable because this is explicitly step one of two the
user asked for.

**Revisit if:** a real provider is added for any of these platforms - swap
that platform's card to the same explicit-connect-function pattern
Meta Ads/Google Ads already use (verify + `recordIntegrationSuccess`/
`recordIntegrationFailure`), and add it to `assertConnectable`'s refusal
list at the same time so the placeholder path can no longer touch it.

---

## 2026-09-13 — Staff dashboard report view gets its own renderer for the Ad Performance Audit shape

**Decision:** `src/app/dashboard/reports/[reportId]/page.tsx` gained a
second recognized report shape, `isAdReportContent` (executive summary +
metrics + channel breakdown + severity-graded diagnostics), rendered with
its own cards - metric tiles, a channel breakdown grid, and a diagnostics
list using `StatusBadge`. Three new severity keys (`WARNING`, `OPPORTUNITY`,
`HEALTHY`) added to `Badge`'s `STATUS_VARIANT` map so that renders in color.

**Rationale:** Every report created via `src/lib/ads/analyzer.ts`'s
`createAndShareClientReport` (the Ads page's "AI Ad Performance &
Impression Audit") stores `{ executiveSummary, metrics, channelBreakdown,
diagnostics, generatedAt }` - a shape that has never matched
`ReportContent` (`summary`/`findings`/`recommendations`). The staff
dashboard's report page only ever recognized `ReportContent`, so **every
single one of these reports** hit its "unexpected format" fallback for
staff, unconditionally - not a corrupted row, a permanent gap. The client
portal (`src/app/portal/reports/[reportId]/page.tsx`) already had a working
`isAdReport` branch rendering this exact shape correctly; this brings the
staff-facing view to parity rather than leaving staff unable to see what
clients could already see.

**Alternative considered:** mapping the ad-report fields onto `ReportContent`
(`executiveSummary` → `summary`, `diagnostics` → `findings`/
`recommendations`) so the existing generic renderer could handle it.
Rejected - `channelBreakdown` has no analog in `ReportContent` at all, and
folding `severity`/`impactEstimate`/`suggestedActionType` into the generic
`priority`/`confidence` fields would lose real structured data to fit an
unrelated shape, not a faithful representation of it.

---

## 2026-09-13 — "My Account": self-service profile + password, no new permission

**Decision:** Added `src/lib/users/profile.ts` (`getOwnProfile`,
`updateOwnName`, `changeOwnPassword`) and a new `/dashboard/account` page.
Every function takes only `AuthContext`, never a target user id - they
always act on `ctx.userId`, so there is no permission to check beyond
"is this a real, authenticated session" (unlike every other mutation in
this app, which checks a named permission before touching someone else's
data). `changeOwnPassword` requires and verifies the current password
whenever one already exists; only a Google-only account with no password
yet can set one without that step. Reachable from the sidebar for every
signed-in staff member (`src/components/dashboard-nav.tsx`).

**Deliberately out of scope for this pass:** self-service email change
(email is the sign-in/invitation identity key - `User.email` is unique
and both invitations and Google account linking key off it, so changing
it safely needs re-verification and collision handling, a materially
bigger feature); MFA self-enrollment (no enrollment UI exists anywhere
yet, not just here - `mfaEnabled` is shown read-only); and an admin-side
"edit another employee's details" on the Team page (a separate,
larger feature - this pass is self-service only).

**Found while building, fixed as a follow-up the same day:** `<Badge
variant="accent">` rendered invisible text everywhere it was used
(`bg-accent` and `text-accent-foreground` both resolved to the same red -
`--primary-tint === --primary` in `src/app/globals.css`, in both the
light and dark blocks - not an actual tint), affecting this page's own
role badge, the Team page's role/client badges, the client-initial
avatars (`dashboard/clients/page.tsx`, `dashboard/clients/[clientId]/
layout.tsx`), and the "Primary contact" tag (`clients/[clientId]/
settings/page.tsx`). Fixed by giving `--primary-tint` an actual tint value
in both themes - matching the already-correct `--blush-tint` (same brand-
red hue, `359deg`), which this reuses verbatim (`359 85% 96%` light,
`359 79% 14%` dark) rather than inventing new numbers. `--primary`/
`--primary-hover` themselves are untouched (used directly as the solid
brand color everywhere else - no reason to touch that).

**Trade-off accepted:** sessions are JWT-based (see the 2026-09-10 "Session
strategy: JWT, not database" entry below) - changing a password here
cannot invalidate any other already-issued session token. Same accepted
trade-off as that decision, not a new one.

---

## 2026-09-13 — AI Gateway reverted from Gemini back to Claude

**Decision:** `src/lib/ai/{client,gateway,models,errors}.ts` now call Claude
via `@anthropic-ai/sdk` again - `getAnthropicClient()` (lazy singleton,
`ANTHROPIC_API_KEY`), `client.messages.parse()` with native structured
outputs (`output_config: { format: zodOutputFormat(schema) }` from
`@anthropic-ai/sdk/helpers/zod`, response on `.parsed_output`), and the
original three model tiers restored to their Claude IDs: `fast` = Claude
Haiku 4.5 (`claude-haiku-4-5-20251001`), `default` = Claude Sonnet 5
(`claude-sonnet-5`, override `ANTHROPIC_DEFAULT_MODEL`), `reasoning` =
Claude Opus 5 (`claude-opus-5`) - with real (non-free) per-tier pricing for
`estimateCostCents`. `@google/generative-ai` removed from `package.json`
(zero remaining imports). This undoes the "Gemini AI swap" recorded in the
2026-09-10 entry below (merged in from a separate branch of UI/feature work
pushed directly to `origin`, not through this session).

**Rationale:** BRD-PRD Section 113 ("Important Claude Rule") states plainly:
"Claude is the primary AI model for MVP. Do not add GPT/Gemini/Grok/etc.
simply for the sake of multiple models" - the Gemini swap was never an
approved deviation from BRD-PRD, just an unreviewed change that landed via
a direct push. The user now holds a working Anthropic API key, which
removes whatever practical constraint motivated the swap, so this restores
the spec rather than introduces a new one.

**Verification note:** every consuming test (`tests/integration/ai-gateway
.test.ts`, `analyze-client-workflow`, `creative-workflow`, `seo-workflow`,
`weekly-intelligence`, `competitor-workflow`, `client-portal-permissions`,
most of `analytics-agent`) turned out to have been left mocking the
Anthropic shape (`setAnthropicClientForTests`/`resetAnthropicClientForTests`,
`{ messages: { parse } }`, `Anthropic.RateLimitError`/`BadRequestError`)
the entire time - only `src/lib/ai/{client,gateway,models}.ts` themselves
and two unit test files (`tests/unit/ai-client.test.ts`,
`tests/unit/ai-models.test.ts`, both added new during the Gemini swap) were
actually Gemini-shaped. Restoring the gateway to match fixed roughly twenty
previously-failing tests that had nothing else wrong with them - they were
failing on `GOOGLE_GENERATIVE_AI_API_KEY not configured` in an environment
that only ever had `ANTHROPIC_API_KEY`.

**Known pre-existing, unrelated gap left as-is:** three assertions in
`tests/integration/analytics-agent.test.ts` (the agent's registered tool
allowlist, and two `dataGaps`-count checks derived from it) fail because
the Analytics Agent's tool registration now includes `meta_ads.get_campaigns`
/ `meta_ads.get_campaign_performance`, added by the same direct-push Meta
Ads integration work and never reconciled with this test. Unrelated to the
AI provider - left for whoever owns that decision (should the test's
expected list grow, or should Analytics Agent not hold those two tools).

**Trade-off accepted:** none functionally - this is a straight revert to
the originally-designed, BRD-mandated provider. `zodOutputFormat()` still
requires schemas built from `zod/v4` (see the 2026-09-10 entry below);
unchanged, since `runStructuredAiTask`'s public signature never moved to
Gemini's schema shape at any call site.

---

## 2026-09-13 — Invite links: `appUrl()` validates `APP_URL`, fails loudly in production instead of sending a broken link

**Decision:** `appUrl()` (`src/lib/users/invitations.ts`, now exported for
testing) no longer just does `process.env.APP_URL ?? 'http://localhost:3000'`.
It trims the value, parses it with `URL` to confirm it's absolute *and has a
host*, and strips any trailing slash. In production, an `APP_URL` that's
unset, blank, or host-less (e.g. `APP_URL="http://"` - a scheme with nothing
after it) now throws a clear error instead of silently building a broken
link. Outside production it still falls back to `http://localhost:3000` for
local-dev convenience.

**Rationale:** A real deployment hit this: `APP_URL` was set but blank/
host-less in Vercel, so invite emails went out with `http:///accept-invite/
<token>` (three slashes, no host) - Gmail flagged it as an invalid URL and
no invitee could ever accept an invitation, with nothing in the app's logs
or UI indicating anything was wrong (the Super Admin saw "Invite sent"). The
old `??` check only catches `null`/`undefined`, not a present-but-empty or
malformed string - exactly the shape a host dashboard's env var UI produces
when a value is left blank or copy-pasted wrong. This is the same class of
problem CLAUDE.md rule 5 exists for ("never fabricate external data... surface
'integration unavailable'") - a broken link silently handed to a real user is
its own kind of fabrication, so this now fails the invite outright in
production rather than degrading invisibly. Covered by
`tests/unit/invite-app-url.test.ts`.

**Trade-off accepted:** `createInvitation` now hard-fails (no invitation
email attempt at all) if `APP_URL` is misconfigured in production, rather
than degrading to "email not sent, here's the raw link" the way a missing
`EMAIL_SERVER_HOST` does - deliberate, since a URL built from a bad
`APP_URL` is broken *even in the raw-link fallback UI*, so there's no
useful degraded mode to fall back to here.

---

## 2026-09-13 — Meta Ads sync: a daily cron, run per-connection instead of per-client

**Decision:** Added `GET /api/cron/meta-ads-sync` (registered in `vercel.json`,
daily at 05:00 UTC — see the correction below), which finds every Meta Ads
`IntegrationConnection` due for a refresh (`findMetaAdsConnectionsDueForSync`
— `CONNECTED`/`DEGRADED`, never synced or stale past the interval) and calls
`syncMetaAdAccountTelemetry` for each,
running as the same real staff actor as the existing weekly-intelligence
automation (`resolveAutomationActor` — see the 2026-09-11 entry below). Unlike
that job, this one runs the sync inline in the serverless function rather
than enqueuing to BullMQ: a Meta Graph API refresh is a few calls and DB
upserts, not an LLM call, so it fits one invocation (`maxDuration = 300`)
without needing the separate always-on worker process the weekly job
requires.

While building this, found and fixed a real bug it would otherwise have
inherited: `syncMetaAdAccountTelemetry` resolved "the client's Meta Ads
connection" via `getProviderConnection`'s `findFirst`, so a client with more
than one connected ad account (a real, supported case — the Integrations tab
lists them individually) had every "Sync Live Data" click and every
connect-time sync silently operate on just one arbitrary connection; the
other connections' `lastSuccessfulSyncAt` never moved again after their
initial connect, with no error surfaced anywhere. `syncMetaAdAccountTelemetry`
now takes an explicit `connectionId` and resolves/stamps that specific row
(`resolveMetaCredentialsForConnection`); the Integrations tab's per-row "Sync
Live Data" button and the Ads page's bulk "Sync all" action were both updated
to pass/loop over the correct connection id instead of just a client id.

**Rationale:** CLAUDE.md rule 5 ("never fabricate external data") cuts both
ways — a stale sync timestamp presented as current is its own kind of
fabrication. Read-only ad-platform telemetry has no spend and takes no
externally-visible action, so per BRD Section 21 it's LOW risk and needs no
`ClientPolicy` opt-in (unlike `weeklyAutomationEnabled`, which gates real LLM
spend). Reusing `resolveAutomationActor` rather than inventing a scheduled-job
identity keeps this on the same authorization chain as every other action in
the app (BRD Section 4.5 / docs/SECURITY.md invariant 3).

**Trade-off accepted:** daily freshness, not hourly — Vercel Cron's Hobby plan
only *accepts* daily-or-coarser schedules; it does not downgrade a more
frequent one, it refuses to deploy at all (see the correction below). A
connection whose client has no eligible staff assigned is skipped (audited
`DENIED`), same as the weekly job — not retried differently.

**Correction (same day):** this entry originally shipped `vercel.json` with
an hourly schedule (`0 * * * *`) and claimed Hobby would "silently coerce" it
to daily. Both were wrong: Vercel's Hobby plan rejects any cron schedule more
frequent than once/day *at deploy time* — every deployment from this
commit through the next three behind it failed outright (Vercel's own check
showed "Deployment failed" on each). Fixed by changing the schedule to
`0 5 * * *` (daily) and raising `findMetaAdsConnectionsDueForSync`'s default
interval from 60 minutes to 20 hours to match. Lesson: a claim about a
third-party platform's behavior needs to be verified against that platform
(its docs, or just watching the deploy), not assumed from a plausible-sounding
guess.

**Revisit if:** sync volume grows enough that looping over every due
connection inline risks the 300s function budget — at that point this should
move to the same BullMQ enqueue-then-worker split as the weekly job (`docs/
ARCHITECTURE.md` §4a).

---

## 2026-09-13 — Google sign-in: an alternative credential for already-invited users, never self-service sign-up

**Decision:** Added a Google OAuth provider to Auth.js (`src/lib/auth/config.ts`),
registered only when `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are both set
(`isGoogleLoginConfigured()`, `src/lib/auth/google-access.ts`) — an unconfigured
deployment gets no `google` entry in `/api/auth/providers` and the sign-in page
shows no button (docs/SECURITY.md — never offer a control that can't work). The
provider sets `allowDangerousEmailAccountLinking: true` so a Google sign-in can
attach to an existing `User` row by email instead of Auth.js refusing with
`OAuthAccountNotLinked`, but a new `signIn` callback gates every Google sign-in
before Auth.js persists anything: `hasGoogleSignInAccess(email)` requires an
`ACTIVE` `User` row that already has real access — an `ACTIVE` `OrganizationUser`
(staff) or a `ClientUser` (client portal) — and returning `false`/a redirect
string from `signIn` leaves no `Account` row behind at all. A rejected sign-in
redirects to `/sign-in?error=google_not_invited` with a plain-language message.

**Rationale:** This app has no self-service sign-up (see the invitation-system
decision below) — the only way anyone gets access is a Super Admin's email
invite (`src/lib/users/invitations.ts`). Adding "Continue with Google" without
this check would let anyone with a Google account that happens to share an
email with an orphaned/disabled `User` row (or, absent the check entirely, any
Google account at all) sign in — a direct violation of CLAUDE.md rule 3
("Claude/agents never decide their own access") and its human-facing
equivalent. `hasGoogleSignInAccess` is the single choke point; it is exercised
by `tests/security/google-signin.test.ts` (no row, disabled user, disabled
membership, active staff, active client-portal — 6 cases).

**Trade-off accepted:** `hasGoogleSignInAccess` lives in its own
`src/lib/auth/google-access.ts` with zero `next-auth`/Next.js imports, purely
so it stays unit-testable — importing anything from `src/lib/auth/config.ts`
transitively pulls in `next/server` via next-auth's internals, which breaks
under Vitest. `config.ts` re-exports both functions so call sites don't need to
know about the split.

**Revisit if:** the product ever wants Google to be able to *create* an
account (true self-service sign-up) — that would need its own explicit
decision and its own risk/approval review, not a change to this check.

---

## 2026-09-10 — Approval Engine replaces the Day 5 hard block via ApprovalRequiredError, not silent execution (Day 10)

**Decision:** `executeTool()`'s risk gate no longer throws `RiskLevelBlockedError`
unconditionally for HIGH/CRITICAL tools. It now creates a `PENDING` `Approval` row
(`src/lib/approvals/approvals.ts`) and throws `ApprovalRequiredError` carrying the
approval's id. A new `executeApprovedTool(ctx, approvalId)` re-runs the same
authorization chain (permissions, client access, agent allowlist all re-checked —
only the risk-level gate is skipped, since the approval itself is that decision) once
a human calls `approveApproval`, and marks the approval `EXECUTED`/`FAILED` based on
the outcome. `RiskLevelBlockedError` is retained only for the case where no
`clientId` was given (an `Approval` requires one — BRD Section 22) or approval
creation itself fails — a HIGH/CRITICAL call must never execute unchecked, so denial
is still the fallback, just no longer the *only* path.

**Rationale:** This is exactly what Day 5's `RiskLevelBlockedError` comment promised:
"Day 10 replaces this hard block with a real approval gate." Building the engine now
was the point of doing Day 5's honest-denial-over-fabricated-approval trade-off in
the first place.

**Consequence for existing tests**: `tests/security/tool-authorization.test.ts`'s
HIGH-risk test was updated to assert `ApprovalRequiredError` + a real `PENDING`
approval row, instead of the old unconditional `RiskLevelBlockedError` — this is a
behavior change on purpose, not a regression; see the test's own history in the same
commit.

---

## 2026-09-10 — Added a distinct `tasks.create` permission, not reused `clients.manage` (Day 10)

**Decision:** `src/lib/rbac/permissions.ts` gained a new permission key,
`tasks.create`, granted to `account_manager` and `marketing_employee` (and
`super_admin`), not `client_user`.

**Rationale:** BRD-PRD Section 4.2-4.4 lists "Create tasks" as an Account
Manager/Marketing Employee capability, not tied to client configuration authority
(`clients.manage`, which only `super_admin` holds in the seeded set) and not granted
to Client User. Reusing `clients.read` would have wrongly let Client User create
tasks too (everyone with `clients.read` could); reusing `clients.manage` would have
wrongly blocked Marketing Employee, who BRD explicitly says can create tasks.
A dedicated permission was the only option that matched BRD's actual role table.

---

## 2026-09-10 — ClientBrain sections fetched as a full row, not per-column Prisma `select` (Day 8)

**Decision:** `getClientBrainSection(s)` (`src/lib/clients/brain.ts`) runs
`db.clientBrain.findUnique({ where: { clientId } })` and picks fields off the result,
rather than `select: { business: true }` etc.

**Rationale:** `docs/DATA-MODEL.md`'s original design note anticipated column-level
`select` as how the Context Router would avoid loading the whole brain. In practice,
`ClientBrain` is one row of at most 4 JSON blobs per client - the realistic content
here (business/audience/brand/marketing notes for one client) is nowhere near large
enough for the `select`-vs-fetch-all difference to matter at Postgres query time, and
fetching the full row keeps the code simple (no per-section switch/case or unsafe
dynamic key typing). The actual thing that matters for BRD Section 7 - not injecting
the whole brain into a prompt - is enforced at the Context Router level
(`assembleClientContext` only returns the sections a category needs), which is
what's actually tested.

**Revisit if:** ClientBrain sections grow large enough (e.g. a business section with
years of accumulated free-text history) that column-level `select` becomes a real
DB-side saving - switch `getClientBrainSection(s)` to per-column `select` at that
point; callers don't need to change.

---

## 2026-09-10 — GA4/GSC providers are resolved per-connection, not per-organization (Day 7)

**Decision:** `resolveGA4Provider`/`resolveGSCProvider` take the resolved
`IntegrationConnection` (via `withIntegrationHealthTracking`'s callback) and decide
mock-vs-real per call, rather than a static `getGA4Provider()` factory like
Metricool's `getMetricoolProvider()`. This required widening
`withIntegrationHealthTracking`'s callback signature from `(externalAccountId:
string)` to `(connection: ResolvedProviderConnection)` — Metricool's tool
registrations were updated to destructure `connection.integrationAccount.
externalAccountId` themselves; behavior is unchanged for Metricool, all its tests
still pass.

**Rationale:** Metricool authenticates with one org-wide API key — the same
provider instance works for every client's brand, so a static factory made sense.
GA4/GSC authenticate per-client via OAuth (each client's Google Analytics/Search
Console property is authorized separately, producing a distinct refresh token per
`IntegrationConnection`) — there is no single "the GA4 provider" for an org, only
"the GA4 provider for this specific client's connection." Passing the connection
through is what makes that possible without a redundant DB lookup inside the
resolver.

**Consequence for future providers**: an org-wide-credential provider (like
Metricool) can ignore the connection object's credentials and just read
`externalAccountId`; a per-client-OAuth provider (like GA4/GSC, and any future
native Ads API using OAuth) uses `loadProviderCredentials(connection)` too. Both
shapes are supported by the same `withIntegrationHealthTracking` signature now.

---

## 2026-09-10 — GA4/GSC use the official `googleapis` client library (Day 7)

**Decision:** `src/lib/integrations/ga4/provider.ts` and `gsc/provider.ts` call the
GA4 Data API (`analyticsdata.properties.runReport`) and Search Console API
(`searchconsole.searchanalytics.query`) via Google's official `googleapis` npm
package, rather than hand-rolled `fetch` calls against the REST endpoints.

**Rationale:** Unlike Metricool (a bespoke MCP surface that had to be verified live
rather than guessed), GA4 and Search Console are Google's own stable, long-documented
public REST APIs with an official, actively-maintained Node client. Method names,
request/response shapes were checked against the *installed package's own TypeScript
definitions* (`node_modules/googleapis/build/src/apis/{analyticsdata,searchconsole}/
*.d.ts`) before writing the adapters — not recalled from training data — so the same
"never guess SDK usage" discipline applies, just resolved by reading the installed
library instead of a live connection.

**Trade-off accepted**: because `googleapis`' generated API clients don't expose an
easy way to inject a fake HTTP transport, the real adapters' request/response mapping
logic isn't independently unit-tested the way Metricool's is (which has a clean MCP
client injection seam). This is a real, documented gap — see docs/MVP-CHECKLIST.md —
not swept under the rug. Adding an HTTP-mocking library (e.g. `nock` or `msw`) would
close it; deferred to keep this day's scope bounded.

---

## 2026-09-10 — Metricool adapter connects via a real MCP client, not Metricool's REST API (Day 6)

**Decision:** `src/lib/integrations/metricool/mcp-client.ts` implements
`MetricoolProvider` as an MCP client (`@modelcontextprotocol/sdk`, Streamable HTTP
transport) connecting to `METRICOOL_MCP_URL`, rather than calling an assumed
Metricool REST API directly.

**Rationale:** BRD-PRD Section 15 explicitly names "Metricool MCP" throughout, and
this session has a live, verified Metricool MCP connection (`Metricool_Social_Media_
Management`) with a confirmed tool surface (checked live during Day 1 — see the
Metricool findings entry below and docs/INTEGRATIONS.md). Guessing at Metricool's raw
REST API shape from training data would violate "never guess SDK usage" / "do not
assume external APIs are available until verified" (BRD Section 116) — building
against the verified MCP tool schemas instead means every request this adapter
constructs is checkable against something real, not invented.

**What is and isn't verified**: the tool *names and input schemas* are verified
(fetched live via this session's own Metricool MCP connection). The *transport
connection itself* — a real `METRICOOL_MCP_URL` + `METRICOOL_API_KEY` reachable from
the deployed application — is not, since no such URL/key has been provided to this
environment. The auth header shape (`Authorization: Bearer <key>`) is a reasonable
default, not confirmed. See docs/EXTERNAL-APPROVALS.md.

**Revisit if**: once real connection details are available and a live test reveals a
different transport (e.g. SSE instead of Streamable HTTP) or auth scheme, update
`mcp-client.ts` accordingly — the rest of the adapter (`provider.ts`) doesn't need to
change, since it only depends on `callMetricoolTool()`'s contract.

---

## 2026-09-10 — Metricool's `schedulePost`/`createPost` always send `draft: true` (Day 6)

**Decision:** Regardless of what `SocialPostInput` the caller provides,
`MetricoolProvider.createPost`/`.schedulePost` always set `draft: true` (and
`autoPublish: false`) in the Metricool `createScheduledPost` payload. Verified by a
dedicated test (`tests/unit/metricool-provider.test.ts`) that asserts this on every call.

**Rationale:** Metricool's `autoPublish: true` would let Metricool itself publish the
content automatically at the scheduled time, with no further TargetGum approval step
— which would make `schedulePost` (classified MEDIUM risk, BRD Section 21 "prepare
scheduled content") a disguised HIGH-risk "publish" action. Since there's no Approval
Engine yet (Day 10) and the Day 5 Tool Registry already hard-blocks HIGH/CRITICAL
tools, keeping `schedulePost` honestly MEDIUM means forcing Metricool into a fully-held
draft state — nothing this adapter does can cause a real-world publish.
`publishPost` is correspondingly unimplemented (`UnsupportedOperationError`): making
an existing draft actually go live is exactly the HIGH-risk operation that needs Day
10's Approval Engine, not something to enable quietly through a MEDIUM-risk tool.

**Revisit**: Day 10, when a real HIGH-risk `publishPost`-equivalent tool can exist
behind the Approval Engine.

---

## 2026-09-10 — HIGH/CRITICAL-risk tools are hard-blocked until the Approval Engine exists (Day 5)

**Decision:** `executeTool()` throws `RiskLevelBlockedError` for any tool whose
`riskLevel` is HIGH or CRITICAL — unconditionally, even for super_admin — rather than
executing it or silently no-op'ing.

**Rationale:** BRD-PRD Section 21 defaults HIGH to "approval required" and CRITICAL
to "approval always required, no override." The Approval Engine that would actually
route such a request to a human doesn't exist until Day 10. Building a partial/stub
approval flow now would be worse than an honest hard block: a stub invites someone to
assume approvals are enforced when they aren't. Denying outright is the only option
consistent with "approval before risk" (BRD Section 3.4) given what's built so far.

**Revisit:** Day 10 replaces this hard block with a real gate — HIGH/CRITICAL calls
create a `PENDING` `Approval` row and wait, rather than deny immediately.

---

## 2026-09-10 — Agent/Tool registration uses find-then-create/update, not `upsert` (Day 5)

**Decision:** `registerTool()` and `registerAgent()` do `findFirst({ organizationId:
null, key })` then `create` or `update`, rather than `db.tool.upsert({ where: {
organizationId_key: { organizationId: null, key } } })`.

**Rationale:** `Tool` and `Agent` use `@@unique([organizationId, key])` for tenant-
scoped tools, but system-wide tools/agents have `organizationId: null` — and Postgres
does not enforce uniqueness across multiple NULLs in a compound unique index. Prisma's
compound-unique `upsert`/`findUnique` still *works* as a read (`WHERE organization_id
IS NULL AND key = ?`), so this isn't broken today, but the DB-level constraint can't
actually stop two racing `registerTool()` calls from creating two system-wide rows
with the same key. Acceptable for now because registration happens idempotently at
single-process startup (never concurrent) — flagged here because it's a real gap if
registration ever needs to be concurrency-safe (e.g. multiple server instances booting
simultaneously and racing to register the same built-in tool).

**Revisit if:** that concurrency scenario becomes real — add a Postgres partial unique
index (`CREATE UNIQUE INDEX ... ON tools (key) WHERE organization_id IS NULL`) via a
raw-SQL migration, since Prisma's schema DSL can't express a partial index directly.

---

## 2026-09-10 — AI Gateway uses named model tiers, not a single hardcoded model (Day 4)

**Decision:** `src/lib/ai/models.ts` defines three tiers — `fast` (Haiku 4.5), `default`
(Sonnet 5, overridable via `ANTHROPIC_DEFAULT_MODEL`), `reasoning` (Opus 5) — and every
AI Gateway call picks a tier, never a raw model string.

**Rationale:** BRD-PRD Section 73 explicitly asks for cost control by client/workflow/
model and to "use cheaper/faster models where appropriate and reserve stronger
reasoning models for tasks that benefit from them." This is a multi-tenant product
running routine analysis for many clients — unlike a one-off engineering task, per-run
model cost compounds across clients and cadence (BRD Section 65's daily/weekly/monthly
scheduled workflows). Centralizing the tier→model mapping in one file means a future
model swap (e.g. a new Haiku release) is a one-line change, not a grep-and-replace.

**Model IDs used:** `claude-haiku-4-5-20251001` (fast), `claude-sonnet-5` (default),
`claude-opus-5` (reasoning). The Haiku ID carries a date suffix while the other two
don't — that's deliberate, matching what this environment's own model-identity
reference gives for Haiku 4.5 specifically (not a copy-paste error).

**Pricing** (USD per 1M tokens, for `estimateCostCents`): Haiku 4.5 $1.00/$5.00,
Sonnet 5 $2.00/$10.00, Opus 5 $5.00/$25.00. These will drift as Anthropic updates
pricing — there's no live pricing API to poll, so refresh this table by hand
(re-consult current Anthropic pricing) when it's noticed to be stale, and note the
update here.

**Which agent uses which tier is not decided yet** — that's a Day 9+ (Analytics
Agent) decision once there's a real workload to tune against, not something to guess
at while building the gateway itself.

---

## 2026-09-10 — Structured outputs via native `output_config.format`, not tool-choice forcing (Day 4)

**Decision:** `runStructuredAiTask` uses `client.messages.parse()` with
`output_config: { format: zodOutputFormat(schema) }` — Anthropic's native structured-
output feature — rather than the older pattern of defining a fake "tool" and forcing
`tool_choice` to get JSON back.

**Rationale:** This is the SDK's own recommended approach for schema-constrained
output (confirmed against the bundled Claude API reference, not assumed from
training). It's simpler, and `response.parsed_output` is either the validated,
correctly-typed object or `null` — no manual `JSON.parse` + Zod `.safeParse` dance,
and no risk of the model narrating outside a tool call.

**Gotcha this forced:** `zodOutputFormat()` requires schemas built from `zod/v4`
specifically (the SDK's typing imports `zod/v4`, not the classic `zod` v3 API this
project uses everywhere else, e.g. `src/lib/auth/config.ts`'s credentials schema).
The installed `zod` package (^3.24, resolved to 3.25.x) ships both APIs under one
package — `import { z } from 'zod'` for everything else, `import { z } from 'zod/v4'`
only inside `src/lib/ai/` for schemas passed to the gateway. This is a real footgun
for future contributors: **a schema built with the classic `zod` import will not
satisfy `zodOutputFormat`'s type**, and the two APIs are similar but not identical
(error customization especially differs). Flagged here rather than only in a code
comment because it's easy to miss.

---

## 2026-09-10 — Session strategy: JWT, not database (Day 3)

**Decision:** `session.strategy = 'jwt'` in the Auth.js config, even though the
Prisma schema has a `Session` table.

**Rationale:** Auth.js's Credentials provider is only supported with JWT sessions —
sign-ins through it aren't persisted to the adapter's `Session` table the way OAuth
sign-ins are, and Auth.js throws a configuration error if you set `strategy:
'database'` while a Credentials provider is registered. The `Session`/
`VerificationToken` models stay in the schema: `VerificationToken` is actively used
by the Nodemailer (magic-link) provider regardless of session strategy, and `Session`
is ready for a future OAuth provider that could use database sessions if one is added.

**Trade-off accepted:** sessions can't be server-side-revoked by deleting a DB row
(they're self-contained encrypted JWTs, valid until expiry). If instant revocation
becomes a requirement (e.g. "kick this user out immediately"), that needs either a
short JWT `maxAge` + a denylist check in the `session` callback, or dropping
Credentials in favor of an OAuth-only + database-session setup.

---

## 2026-09-10 — No Next.js middleware for route protection (Day 3)

**Decision:** `/dashboard` (and future protected routes) enforce auth via a
`redirect()` check at the top of each server component (see
`src/app/dashboard/page.tsx`), not `middleware.ts`.

**Rationale:** Auth.js's documented pattern for edge-compatible middleware requires
splitting the config into an edge-safe partial (no Prisma adapter, no
Node-only `bcryptjs`/`otpauth` in the `authorize` callback) and a full Node.js config
used everywhere else — real complexity for one extra layer of defense, given every
protected page already calls `getCurrentAuthContext()` and redirects. Page-level
guards are enforced today and verified live (unauthenticated `/dashboard` → 307 to
`/sign-in`, confirmed via `curl`).

**Revisit if:** the protected-route surface grows large enough that repeating the
guard per-page becomes error-prone (a forgotten guard is a real vulnerability) — at
that point, either build the edge-safe split properly, or force Next.js middleware
onto the Node.js runtime (stable as of Next 15.2+) so the full config can be reused
without an edge-compatibility rewrite.

---

## 2026-09-10 — Password hashing: bcryptjs over argon2/native bcrypt

**Decision:** `bcryptjs` (pure JS, cost factor 12) for password hashing.

**Rationale:** No native bindings to compile — one less thing to break across the
range of environments this repo will run in (local dev, CI, various hosting
platforms). Argon2 is the stronger modern choice on paper, but its native dependency
has repeatedly been a source of build friction in Node/serverless environments;
bcrypt's security margin is still adequate for this product's threat model at MVP
stage.

**Revisit if:** a security review specifically calls for Argon2id, or password
hashing throughput becomes a measured bottleneck.

---

## 2026-09-10 — MFA: `otpauth` (TOTP) with envelope-encrypted secrets; recovery codes not yet persisted

**Decision:** `src/lib/auth/mfa.ts` generates/verifies TOTP codes via `otpauth`
(pure JS). The secret is envelope-encrypted (`src/lib/crypto/envelope.ts`) before
`User.mfaSecret` is ever written — `generateMfaSecret` returns the plaintext only for
one-time QR/manual-entry rendering during enrollment; callers must persist only
`encryptedSecret`. `generateRecoveryCodes` exists but nothing yet stores or verifies
them against a "used" state — no `RecoveryCode` table exists.

**Rationale:** Auth.js has no built-in MFA (see the Day-1 auth decision above); TOTP
is the standard second factor and `otpauth` avoids a native-binding dependency.
Recovery codes were scoped out of Day 3 to keep the slice reviewable — shipping the
core enroll/verify loop now, with recovery-code persistence tracked as a named gap in
`docs/SECURITY.md` rather than silently deferred.

**Revisit before this MFA flow is offered to real users:** add a `RecoveryCode`
table (hashed, single-use) and enrollment/recovery UI.

---

## 2026-09-10 — Prisma naming: camelCase fields, `@@map` to snake_case tables

**Decision:** `prisma/schema.prisma` uses idiomatic Prisma/TypeScript camelCase field
names (`organizationId`, `clientId`, `createdAt`) rather than the literal snake_case
shown in `docs/BRD-PRD.md`'s illustrative pseudocode. Table names are mapped to
snake_case via `@@map` (e.g. `model AuditEvent` → table `audit_events`) so the
physical schema still reads the way the BRD's examples do.

**Rationale:** BRD Section 32's pseudocode (`organization_id`, `client_id`, ...) is
describing required columns conceptually, not mandating literal casing. camelCase is
the Prisma/TS convention and avoids `@map` boilerplate on every field.

---

## 2026-09-10 — Full Data Model schema implemented (Day 2)

**Decision:** Implemented all 43 tables from `docs/DATA-MODEL.md` as the initial
Prisma migration (`prisma/migrations/20260910092421_init`), applied against a local
Postgres 16 instance and verified with a seed script (org + 4 system roles + starter
permission set + one sample client). `npm run typecheck`, `lint`, `test:unit`, and
`build` all pass against the generated client.

**Notable modeling choices not spelled out in the BRD:**
- `ClientBrain` stores `business` / `audience` / `brand` / `marketing` as validated
  JSON columns (one row per client) rather than seven separate tables, so the Context
  Router can select a single column without loading the whole brain (see
  `docs/DATA-MODEL.md`). Competitors, feedback, brand assets, and policy get real
  tables because they're listed, enforced, or queried individually.
- `ClientPolicy` fields that gate the Approval Engine (`maxDailyAdBudget`,
  `maxBudgetChangePercent`, `autoPublishSocial`, `autoChangeAds`,
  `requireApprovalForCampaignLaunch`) are typed columns, not JSON, plus an `extra`
  JSON overflow field for policy knobs not yet promoted to a column.
- Normalized metric tables (`CampaignMetric`, `SocialMetric`, `SeoMetric`,
  `AnalyticsSnapshot`) each carry `source` / `retrievedAt` / `period` provenance
  columns plus a `raw` JSON column preserving the original provider payload, per BRD
  Section 37/69.
- `AuditEvent` has no update/delete path in application code (append-only by
  construction); a DB-level `REVOKE UPDATE, DELETE` for the app role is still
  pending a hosting decision on how the app's DB role is provisioned — tracked in
  `docs/SECURITY.md`.
- Auth.js v5's required `Account` / `Session` / `VerificationToken` models are
  included now (Day 2) even though auth itself lands Day 3, so the schema doesn't
  need a second migration just to add them.

**Revisit if:** ClientBrain's JSON sections need per-field query/index performance
that column-level Prisma `select` can't give (e.g. searching within `business.industry`
at scale) — split into typed sub-tables at that point.

---

## 2026-09-10 — Hosting confirmed: Vercel + managed Postgres + Upstash Redis + Cloudflare R2

**Decision:** User confirmed the proposed default in `docs/ARCHITECTURE.md` — Vercel
for the app, a managed Postgres provider (Neon or Supabase, final pick deferred to
Day 2 staging setup), Upstash for Redis/BullMQ, Cloudflare R2 for object storage.

**Status:** Confirmed for staging/production. Local development in this repo uses a
local PostgreSQL 16 instance (see `.env.local`, gitignored) — no hosted resources are
provisioned yet.

---

## 2026-09-10 — Metricool MCP: ads read/analysis confirmed available; ads write/management not exposed by this MCP

**Decision:** Proceed with Metricool for ads *analysis* (read) in the MVP workflow;
do not plan on Metricool for ads *management* (write) — that capability isn't present
in this MCP server's tool surface at all, independent of account plan.

**Findings (checked live against the connected Metricool MCP in this environment,
account owner `info@tapashub.com`):**
- `getAnalyticsDataByMetrics` / `getAnalyticsAvailableMetrics` support `network`
  values including `googleAds`, `metaAds`, `facebookAds`, `tiktokAds` with a full
  metrics schema (spend, impressions, clicks, conversions, CPC, CPM, CTR, ROAS) at
  both account-evolution and per-campaign granularity — this covers the MVP
  "Analyze Client A's ads performance" workflow (BRD Section 19: read-only analysis,
  no modification).
  Note: this metric-schema check does not need write access to an ad
  account - it worked even though no Google Ads account is currently connected
  (see below), so its presence alone doesn't guarantee a given client's data is
  populated. Verify per-client before relying on it for a pilot.
- No campaign/budget/bid write endpoints exist in this Metricool MCP's tool list at
  all (only `createScheduledPost` / `updateScheduledPost` / `sendScheduledPostForReview`
  for **social**, nothing ads-equivalent). This is a property of the MCP server, not
  something an account upgrade would unlock. Matches BRD Section 20's framing of ads
  optimization/execution as later, policy-gated work anyway — not a Day 6 blocker.
- Five brands are connected on this account: **HUGFAB**, **LHO** (Facebook Ads
  connected, account `act_27530167156623376`), **TargetGum**, **undertreegames**
  (Facebook Ads connected, `act_1250233737082703`), **Pepalworks**. None currently
  have a Google Ads account connected in Metricool.
- Implication for the pilot: if the pilot client maps to **LHO** or
  **undertreegames**, Facebook/Meta Ads read analysis is available today. If it needs
  Google Ads specifically, that requires either connecting a Google Ads account to
  the relevant Metricool brand, or a native Google Ads API integration (Phase 2, BRD
  Section 52) for that one channel.

**Revisit if:** ads write/management becomes a real MVP requirement — that's a native
`GoogleAdsProvider`/`MetaAdsProvider` (Phase 2), not something to wait on Metricool for.

---

## 2026-09-10 — Repository structure adapts BRD Section 75/10 module list to Next.js conventions

**Decision:** Application modules (`/social`, `/advertising`, `/analytics`, `/seo`,
`/creative`, `/reports`, `/approvals`, `/tasks`, `/settings`, etc.) are implemented as
route groups under `src/app/` plus supporting logic under `src/lib/`, rather than as
top-level directories.

**Rationale:** Next.js App Router expects routes under `app/`. Keeping the module
boundary in `lib/` (one subfolder per module) preserves the intent of BRD Section 10
(no separate deployable services, clear module boundaries) without fighting the
framework's routing conventions.

**Alternative considered:** Literal top-level `/social`, `/advertising`, etc.
directories outside `src/`. Rejected — would require custom routing glue with no
benefit over App Router route groups.

---

## 2026-09-10 — ORM: Prisma

**Decision:** Prisma over Drizzle for the initial schema and all query access.

**Rationale:** BRD Section 9 leaves the choice open but asks it be documented. Prisma
was chosen for: mature migration tooling (`prisma migrate`) that fits the "keep
migrations small and reviewable" rule in `CLAUDE.md`; generated types that pair well
with the tenant-scoped query-helper pattern in `src/lib/db/`; and broad familiarity,
which matters for a small team maintaining this long-term. Drizzle's lighter runtime
and closer-to-SQL feel are real advantages but not decisive at this stage.

**Revisit if:** query performance at scale becomes a bottleneck Prisma's query engine
can't address, or the team wants more direct SQL control.

---

## 2026-09-10 — Auth: Auth.js (NextAuth v5) + Prisma adapter + custom TOTP MFA + custom RBAC

**Decision:** Self-hosted auth using Auth.js v5 with the Prisma adapter for
sessions/accounts, credentials + magic-link (email) providers, a custom TOTP-based MFA
layer (Auth.js has no built-in MFA), and a custom RBAC schema (`roles`, `permissions`,
`organization_users`, `client_users`) rather than a third-party auth platform.

**Rationale:** BRD Section 9 requires email/password or magic link, OAuth capability,
MFA, session management, and RBAC. A turnkey platform (Clerk, WorkOS, Auth0) would give
MFA and session management out of the box but would fight the custom multi-tenant RBAC
model this product needs (organization-level + client-level permissions, agent
authorization checks reusing the same permission resolution as human users — BRD
Section 31). Keeping auth data in our own Postgres also keeps tenant-isolation testing
(BRD Section 80) inside one system instead of split across our DB and a vendor's.

**Trade-off accepted:** more auth code to write and test ourselves (MFA enrollment,
recovery codes, session revocation) versus a vendor's polished flows. Mitigated by
budgeting explicit test coverage for this in Day 3 (`docs/MVP-CHECKLIST.md`).

**Revisit if:** the team wants SSO/SAML for enterprise clients sooner than Phase 2 —
a vendor platform becomes more attractive at that point.

---

## 2026-09-10 — Hosting target: proposed, not yet decided

**Status:** Open. `docs/ARCHITECTURE.md` proposes Vercel + managed Postgres (Neon/
Supabase/RDS) + Upstash Redis + Cloudflare R2 as a default low-ops baseline consistent
with BRD Section 94 ("managed Postgres, managed Redis, managed object storage, secure
hosting"), but this has not been confirmed with the user. See open questions.

---

## 2026-09-10 — Day 11: minimal WorkflowRun/WorkflowStep tracking, not the general Workflow Engine

**Decision:** `src/lib/workflows/runs.ts` implements just enough to give the
"Analyze Client A" workflow (`src/lib/workflows/analyze-client-workflow.ts`)
a durable, auditable run record — `getOrCreateWorkflow`,
`startWorkflowRun`, `recordWorkflowStep`, `completeWorkflowRun` — rather
than building the full Workflow Engine BRD-PRD Section 23 describes
(scheduling, delays, conditions, retries, timeouts, pause/resume as a
generic state machine).

**Rationale:** There is exactly one real workflow to run through the engine
right now. Building generic scheduling/retry/pause-resume infrastructure
against a single caller means guessing at an API shape with no second data
point to validate it against — a classic premature-abstraction risk. The
minimal tracker still satisfies what Section 23 actually requires *today*:
every stage is recorded as a `WorkflowStep` with status transitions
(`RUNNING` → `SUCCEEDED`/`FAILED`/`SKIPPED`), the overall run is durable
and queryable (`WorkflowRun`), and failures are captured with their error
rather than silently swallowed.

**Trade-off accepted:** no scheduling, no automatic retries, no pause/resume
for approval waits (an approval created mid-workflow is a fire-and-forget
side effect the workflow doesn't block on — the workflow's own run
completes once it has created the approval, not once the approval is
decided), no idempotency-key replay protection at the workflow level (Day
10's approval/tool layer already has this for the one place it currently
matters — see `docs/APPROVALS.md`). These are the parts of Section 23 the
MVP does not yet need.

**Revisit if:** a second real workflow (e.g. the creative workflow, BRD
Section 47, or scheduled daily/weekly automation, Section 65) needs the
same shape — generalize `src/lib/workflows/runs.ts` into the full engine
at that point, informed by two concrete call sites instead of one.

---

## 2026-09-10 — Day 11: reports are built from structured `AnalysisResult`, never a fresh AI call

**Decision:** `generateReport` (`src/lib/reports/generate.ts`) transforms
an agent's already-validated `AnalysisResult` into a `ReportContent` shape
in application code. It never asks Claude to re-describe or re-summarize
the numbers into report prose.

**Rationale:** BRD Section 68 explicitly warns against the "Claude guesses
metrics" anti-pattern — a report is a rendering of data that already went
through structured-output validation (Day 4's `zodOutputFormat`) and, for
CLIENT-type reports, a redaction step (dropping `evidence`/`confidence`/
`dataGaps` per Section 41/102's "don't expose internal AI reasoning" rule).
Adding a second AI call to turn that data into a report would spend money
for no informational gain and reintroduce exactly the fabrication risk
Section 68 calls out.

**Revisit if:** product wants a narrative/prose report style beyond
structured findings + recommendations — even then, the better fix is a
templating pass over `ReportContent`, not a fresh model call re-deriving
facts already known and validated.

---

## 2026-09-10 — Day 13: `workflow_runs.workflowId` foreign key changed from RESTRICT to CASCADE

**Decision:** Changed `WorkflowRun.workflow`'s relation from Prisma's implicit
default (`ON DELETE RESTRICT`) to `onDelete: Cascade` (migration
`20260910111038_workflow_run_cascade_delete_on_workflow`).

**Rationale:** Discovered while building the Day 13 dashboard and smoke-testing
it end-to-end: `Organization` cascade-deletes its `Workflow` rows, but
`WorkflowRun.workflowId` had no `onDelete` set, which Prisma/Postgres
resolves to `RESTRICT` — so deleting an `Organization` that has ever run
the "Analyze Client A" workflow (Day 11) failed with a foreign-key
violation. `tests/helpers/factory.ts`'s `cleanupOrg` silently swallows its
own delete error (`.catch(() => undefined)`, needed so parallel test files
don't fail on an already-cleaned-up org), which hid the failure: every
`tests/integration/analyze-client-workflow.test.ts` run left its
Organization/Workflow/WorkflowRun rows behind in the database instead of
actually cleaning up. Confirmed and fixed by querying the dev database
directly (6 orphaned test organizations found, including the Day 2 seed
org `TargetGum Digital Marketing` from an earlier session — restored via
`npx prisma db seed`, which is idempotent and safe to re-run).
`WorkflowRun` rows have no meaning once their `Workflow` definition is
gone, so cascading is the correct behavior here (unlike `Approval` or
`ToolExecution`'s `SetNull` on `workflowRunId`, which are their own durable
records that should survive a workflow run being cleaned up).

**Revisit if:** a product requirement emerges to retain `WorkflowRun`
history independently of its `Workflow` definition (e.g. for long-term
audit even after a workflow is redefined/removed) — that would call for
`SetNull` (making `workflowId` nullable) instead of `Cascade`.

---

## 2026-09-10 — Day 15: fixed a real Metricool parsing bug found via live (not mocked) data

**Decision:** Rewrote `getAnalytics`/`getCampaigns`/`getCampaignPerformance` in
`src/lib/integrations/metricool/provider.ts` to parse `getAnalyticsDataByMetrics`'s
actual response shape (`{ rows: [[...positional values..., "YYYYMMDD"]] }`), replacing
code that assumed a `fieldId`-keyed object.

**Rationale:** This session has its own live, already-connected Metricool MCP
connection (account `info@tapashub.com`), independent of the deployed app's missing
`METRICOOL_MCP_URL`. Day 15's pilot-readiness pass used it to call
`getAnalyticsDataByMetrics` against a real brand (TargetGum, id `6818704`) and compare
the actual response against what the adapter's parsing code expected. They didn't
match: the real shape is an object with a `rows` array of positional value arrays
(numbers as strings, a trailing date), not the `fieldId`-keyed object the Day 6
implementation assumed from documentation alone. The bug was silent - Zod's
`.optional()` on every metric field meant broken parsing produced empty-but-valid
output, not a thrown error, so no test (all built against mocks matching the *wrong*
assumed shape) could have caught it. Only checking against real data did.

**Trade-off accepted:** the `campaigns` connector (ad campaign listing/performance)
is assumed to share the same wire shape as the verified `evolution` connector (same
underlying MCP tool) but wasn't independently confirmed - no brand with a populated,
connected ads account was available in this account. Flagged in
`docs/EXTERNAL-APPROVALS.md` as still needing confirmation once one exists.

**Revisit if:** a populated ads account becomes available and the `campaigns`
connector's real shape turns out to differ from `evolution`'s.

**Broader lesson, applied going forward:** "verified against documented schemas" and
"verified against live data" are different claims - this codebase's docs (Day 6's
original `docs/INTEGRATIONS.md` entry) said the former but read, in places, like the
latter. Every "not live-verified" entry in `docs/EXTERNAL-APPROVALS.md` should keep
being read literally, and any future case where live access to a *read-only* external
system exists (even indirectly, like this session's own Metricool MCP connection)
should be used to check real response shapes before calling an adapter done, not just
its request-building logic.

---

## 2026-09-10 — Day 15: client creation and Metricool connection, missing until now

**Decision:** Added `createClient` (`src/lib/clients/create.ts`, gated by
`clients.manage`) and `connectClientToMetricoolBrand`
(`src/lib/integrations/metricool/connect.ts`, gated by `integrations.manage`,
verifies the brand id via a real `getConnectedNetworks` call rather than trusting it),
plus dashboard forms for both.

**Rationale:** Auditing the codebase against BRD Section 84's MVP Exit Criteria
("Real client can be created") during Day 15 found a real gap: every `Client` row up
to that point came from `prisma/seed.ts` or test factories - `connectClientToProviderAccount`
(`src/lib/integrations/health.ts`, since Day 6) had no caller anywhere in the app
itself. A genuine pilot needs both a real code path to create the pilot client and a
way to connect it to Metricool (which, unlike GA4/GSC, needs no OAuth app - BRD
Section 92/the earlier ORM-style decision above - so this could be a same-request
"connect and verify" action rather than a multi-step OAuth flow).

**Trade-off accepted:** GA4/GSC connection still has no UI - those need a real OAuth
app (Google Cloud client id/secret) and callback route neither of which exist in this
environment (`docs/EXTERNAL-APPROVALS.md`), and pasting a raw refresh token into a
form is the wrong security pattern to build even as a stopgap. Left as documented,
explicitly blocked infrastructure rather than a half-built credential-paste form.

**Revisit if:** a real Google Cloud OAuth app becomes available - build the actual
OAuth consent + callback flow then, not a manual-token form now.

---

## 2026-09-10 — Phase 2: permission model split (`clients.edit`, `recommendations.review`, `feedback.create`, `analysis.trigger`) instead of reusing existing permissions

**Decision:** Added four new permissions rather than reusing `clients.manage`/
`approvals.request` for the Client Portal's needs, and split `clients.manage`'s
two prior meanings (org-wide client creation vs. editing an already-accessible
client) into `clients.manage` (creation, unchanged, Super-Admin-only) and a new
`clients.edit` (editing, now also granted to `account_manager` for their assigned
clients).

**Rationale:** Building the Client Portal (`src/app/portal/`) required deciding
what a `client_user` can do to a recommendation and to feedback. The existing
permissions that gated those actions - `approvals.request` for accept/reject,
`clients.manage` for feedback - were never designed with a client-portal caller in
mind: `approvals.request` is documented and used elsewhere as "Account Manager +
Marketing Employee can request/view [formal Approval Engine] approvals," a
materially different, more sensitive capability (visibility into HIGH/CRITICAL
tool-execution approval requests) than "review and accept/reject a recommendation."
Granting `client_user` (or reusing) `approvals.request` to unblock recommendation
review would have also handed them `listApprovals`/`cancelApproval` - visibility
into the Approval Engine that BRD Section 4.4 never lists and Section 4.2/4.3
reserve for staff. Same problem with `clients.manage` for feedback: it's shared
with Brain/Policy/brand-asset/competitor writes, none of which a client should
touch. Re-reading BRD Section 4.1-4.4's capability lists against the seeded
permission set is what surfaced this - see `docs/MVP-CHECKLIST.md`'s Phase 2
section for the full list of gaps this closed, including a real authorization
hole (nothing stopped a `client_user` from triggering a paid AI analysis run
themselves) and a real data-exposure gap (nothing stopped a `client_user` from
reading an INTERNAL report's evidence/confidence by direct id).

**Trade-off accepted:** four more entries in the `PERMISSIONS` array/more surface
to reason about, versus reusing two already-existing ones. Precision over economy:
a permission whose name and granted-role set don't match what it actually gates is
exactly the kind of drift that produces silent authorization bugs later (this
decision fixed three of them). `marketing_employee` deliberately did NOT get
`feedback.create` or `clients.edit` - BRD Section 4.3 doesn't list client
communication or client management for that role, and "give it anyway, seems
harmless" is exactly the kind of permission creep this pass was cleaning up.

**Revisit if:** a fifth role or a genuinely different recommendation-review flow
(e.g. a client delegate who can review but never decide) needs an even finer split
than `recommendations.review` currently provides.

---

## 2026-09-10 — Design system pass: CSS-variable tokens + a small hand-built component library, not shadcn's CLI

**Decision:** Adopted a proper design token system (HSL CSS variables for
background/foreground/primary/secondary/muted/accent/card/border/ring plus
semantic status colors - success/warning/destructive/info - each with a light
and dark definition), a violet primary brand color, the Inter font via
`next/font/google`, and a small hand-written component library
(`src/components/ui/`: `Button`, `Badge`/`StatusBadge`, `Card`, `Input`/
`Textarea`/`Label`, `EmptyState`, `PageHeader`) plus a sidebar-based dashboard
shell with `lucide-react` icons throughout. Every page in `src/app/dashboard/`
and `src/app/portal/` was rebuilt on these primitives.

**Rationale:** The MVP build (Days 1-15) deliberately used bare Tailwind
utility classes throughout - correct sequencing per `CLAUDE.md`'s "build
incrementally" and the BRD's phased plan, since proving the system worked
mattered more than how it looked. Once asked directly to raise visual
quality, doing it as a real token system rather than one-off color tweaks
per page means every future page automatically matches (badges, cards,
buttons all read from the same palette) and dark mode support is nearly
free (the tokens already have `.dark` definitions, `darkMode: 'class'` was
already configured in `tailwind.config.ts` from Day 1 anticipating this).

**Trade-off accepted:** hand-writing the component library instead of
running the shadcn/ui CLI (`docs/ARCHITECTURE.md`'s originally documented
plan, "shadcn components added on demand") - this environment can `npm
install` packages but the shadcn CLI's registry-fetch flow wasn't verified
here, and the actual components needed (Button/Badge/Card/Input) are a
small, well-understood set not worth the extra dependency surface. Added
`clsx`/`tailwind-merge`/`class-variance-authority` (shadcn's own
dependencies) so a later `npx shadcn add <component>` still drops in
cleanly on top of this if a more complex component (a real Select, a Dialog)
is ever needed.

**Revisit if:** a component with real interaction complexity (a combobox, a
modal, a date range picker) is needed - reach for the shadcn CLI or Radix
primitives directly at that point rather than hand-rolling one.

---

## 2026-09-10 — Palette/typography replacement: warm-neutral + terracotta, replacing the violet token system

**Decision:** Replaced the violet-brand HSL token system from the prior
design-system pass with a fully specified warm-neutral palette (a cream
`--bg-page`/white `--bg-surface`, a three-tier text scale `--text-primary`/
`--text-secondary`/`--text-muted`, a terracotta `--primary` reserved for
CTAs/active nav/key metrics, and five single-purpose status hues - sage
(success), dusty-blue (info), lavender (reserved for future AI-generated-
content badges, not yet wired to any element), mustard (warning), rose
(destructive)). Values are stored as HSL triplets (not hex) so Tailwind's
`bg-x/NN` opacity-modifier syntax keeps working; every triplet renders the
exact hex specified. Added one derived tier not in the source spec: a
darker "-text" reading of each status hue for badge/table text, because the
raw hues are ~2-3:1 contrast on white (too low for small text) - the raw
hue stays the canonical swatch for dots/tints, the darker "-text" variant
(~4.5-6.5:1) is what `success`/`warning`/`destructive`/`info` actually
resolve to. Typography: font-weight capped at 400/500 everywhere
(`font-semibold`/`font-bold` purged from all 18 files that had them),
`uppercase`/`tracking-wide` table headers removed in favor of sentence
case, `StatusBadge` now renders `toSentenceCase(status)` instead of the raw
enum ("IN_PROGRESS" → "In progress"), a new `text-caption` token/utility
added for labels/timestamps/table headers (previously these shared
`text-muted-foreground` with body-secondary text; the spec wants three
distinct tiers), and `tabular-nums` added to every numeric column and stat
value. Dropped the `.dark` token block entirely - grep confirmed zero
`dark:` classes and no theme toggle anywhere in the app, so it was dead
weight duplicating every color for a mode nothing could reach.

**Rationale:** Direct, specific feedback that the violet palette read as
"basic" and the UX as unpolished; the replacement palette, exact hex
values, and typographic rules (weight ceiling, sentence case, a 3-tier text
scale, tabular numerals) were fully specified rather than left to
interpretation, so token-for-token color/typography implementation was the
right scope - explicitly *not* a layout or component-structure change
(confirmed by audit: no hardcoded colors existed anywhere in the codebase
before this pass, so the change is contained to `globals.css`,
`tailwind.config.ts`, and per-file className edits, no JSX restructuring).

**Trade-off accepted:** the exact status hues given (sage/mustard/rose/
dusty-blue) are not text-safe on their own (WCAG contrast 1.9-3.2:1) - held
the literal hex values as canonical swatches per the spec, and derived a
separate darker "-text" stop of the same hue for anywhere that hue is used
as small text, rather than silently substituting a different color or
shipping illegible badges.

**Revisit if:** a real AI-generated-content marker is added to the product
(recommendations already carry `aiRunId`, so this is the obvious next
touchpoint) - wire the reserved `--lavender`/`ai` token to it then, rather
than retrofitting a new color at that point.

---

## 2026-09-10 — Phase 2: social content calendar, `content.manage` permission, and a Tool Registry bootstrap fix found along the way

**Decision:** Built the first Phase 2 item picked from BRD Section 85's
backlog - the social content calendar (Section 66's `content_calendar`
entity, Section 48's MVP Social Scheduling flow). `src/lib/content-
calendar/persist.ts` implements the full lifecycle: `IDEA -> DRAFT ->
IN_REVIEW -> APPROVED -> SCHEDULED`, with `CANCELLED` reachable from any
non-terminal state. `scheduleContentCalendarItem` (`APPROVED -> SCHEDULED`)
calls the already-registered `metricool.schedule_post` Tool Registry entry
through `executeTool` - same authorization/audit chain as every other tool
call, never the Metricool provider directly (CLAUDE.md rule 6). Because
that tool's adapter always sends `draft: true` (`src/lib/integrations/
metricool/provider.ts`'s safety rule), `PUBLISHED` is not reachable from
this module - a real publish is its own HIGH-risk, Approval-Engine-gated
tool, the separate "Automated social scheduling" Phase 2 item.

New permission `content.manage` (`src/lib/rbac/permissions.ts`) covers
create/edit-while-draft/submit-for-review/approve/schedule/cancel, granted
to both `account_manager` and `marketing_employee` - deliberately one
permission, not split into a separate "approve" grant the way the formal
Approval Engine is: BRD 4.3 explicitly gives Marketing Employee "Create/
schedule social posts" (the whole lifecycle themselves), while 4.2's
"Approve selected actions" already covers Account Manager doing the same
for someone else's draft. `client_user` gets no new permission at all -
reading the calendar (`listContentCalendarItems`, gated on the existing
`clients.read` every role already holds, same pattern as
`recommendations`/`reports`) is what closes BRD 4.4's previously-
unimplemented "View content/creative" - noted as a gap in
`docs/MVP-CHECKLIST.md`'s Phase 2 section since the Client Portal audit.
Surfaced in the UI as: a new "Content calendar" dashboard page (owns the
status-transition actions - submit/approve/schedule/cancel - across every
client, same split as Recommendations/Tasks between their aggregate page
and a client's own detail page), a read-only + create-form card on the
client detail page, and a read-only card in the Client Portal.

**A real bug found and fixed while wiring `scheduleContentCalendarItem`:**
nothing in the running app ever called `registerMetricoolTools()`/
`registerGA4Tools()`/`registerGSCTools()`/`registerMarketingAnalyticsAgent()`
outside test suites' own `beforeAll` blocks. `registerTool` stores a tool's
callable implementation in an in-memory `Map` (`src/lib/tools/
registry.ts`) that a fresh server process starts with empty; `executeTool`
would resolve the `Tool` database row fine (also upserted by
`registerTool`) but find no matching implementation, throwing
`ToolNotFoundError` on literally the first tool call of a new process - "
Analyze this client" included, not just this new Schedule button. Not
caught earlier because every prior live verification in this environment
seeded `AiRun`/`Recommendation` rows directly rather than actually
triggering the workflow through a running server process. Fixed with
`src/lib/tools/bootstrap.ts`'s `ensureToolsRegistered()` - idempotent,
guarded by a module-scope flag, called at the top of `executeTool`'s
`authorizeCall` (`src/lib/tools/execute.ts`) so every tool call is
self-healing regardless of entry point. Live-verified end-to-end with
Playwright: connected a client to Metricool, created a content item as
`marketing_employee`, carried it through submit/approve/schedule, and
confirmed a real Metricool mock draft id came back - proving the bootstrap
fix, not just the content-calendar logic in isolation.

**Rationale:** Reused every existing pattern (permission-per-module,
`getOwnedX`/`assertClientAccess` ownership checks, aggregate-page-owns-
actions/detail-page-owns-creation, `executeTool` for the one external
side-effect) rather than inventing new ones - this module should read as
unsurprising to anyone who's read `recommendations/persist.ts` or
`tasks.ts`. The bootstrap fix was in-scope rather than deferred: without
it, the very feature being built wouldn't work the first time a real
server process tried to schedule anything.

**Trade-off accepted:** `ClientPolicy.autoPublishSocial` is not consulted
anywhere in this module, even though BRD Section 21 calls "prepare
scheduled content" MEDIUM risk with a "configurable" default. No other
module in this codebase makes tool execution conditional on a `ClientPolicy`
field yet (risk level is a static property of the tool, per
`src/lib/tools/registry.ts`) - inventing a first instance of dynamic,
policy-driven authorization for this one feature would be a bigger,
less-consistent change than the feature itself.

**Revisit if:** `ClientPolicy`-driven risk/approval logic gets built for
any module (the natural point to also wire `autoPublishSocial` in here),
or when the "Automated social scheduling" / Canva creative workflow Phase 2
items land and need `PUBLISHED`/`CreativeAsset` wiring this module
deliberately left untouched.

---

## 2026-09-10 — Phase 2: SEO Agent + "Run SEO analysis" workflow

**Decision:** Built the SEO Agent (BRD Section 25's "Later" agent list,
brought forward as a Section 85 Phase 2 item) as its own agent rather than
folding it into the Marketing Analytics Agent, which already reads Search
Console data as one of several sources. `src/lib/agents/seo-agent.ts`
gathers only Search Console query- and page-level performance (two
`gsc.get_search_performance` calls, one per dimension - richer than the
general agent's single query-dimension call) through the already-
registered tool, and produces the same `AnalysisResult` shape every other
agent does. `src/lib/workflows/seo-analysis-workflow.ts` mirrors
`analyze-client-workflow.ts` step-for-step (persist recommendations, route
to task/approval, generate a report, audit) with zero new logic invented -
same authorization gate (`analysis.trigger`, staff-only), same downstream
pipeline. Surfaced as a second "Run SEO analysis" button next to "Analyze
this client" on the client detail page, and a new `/dashboard/seo`
aggregate page (`src/lib/seo/persist.ts`) mirroring the Recommendations/
Content-calendar aggregate-page pattern.

Extracted the shared `RecommendationSchema`/`AnalysisResultSchema` zod
definitions the analytics agent had inline into `src/lib/agents/
schemas.ts` so both agents produce structurally identical output without
copy-pasting the schema - a pure refactor, no behavior change (verified by
the full existing test suite passing unchanged).

**Identifying "SEO" recommendations reliably:** the SEO Agent's prompt
(`prompts/seo/v1.md`) deliberately keeps each recommendation's `area`
field specific and varied ("Query CTR", "Page rankings", ...) rather than
a constant "SEO" - more useful to read, but not something a UI filter
should trust matching on (the general Marketing Analytics Agent can
legitimately also produce an `area: "SEO"` recommendation as part of an
omnibus analysis - collapsing both into the same free-text value would
make them indistinguishable). Instead, `listSeoRecommendations`/
`listSeoRecommendationsForOrg` filter on `AiRun.contextIds.agentKey`
(a Prisma JSON `path`+`equals` filter on Postgres - the first use of that
pattern in this codebase) so only recommendations the SEO Agent itself
produced are ever returned. Directly tested: a general-agent recommendation
with `area: "SEO"` and an SEO-agent recommendation are both created in the
same test, and only the latter comes back from either listing function.

Also added an optional `reportName` parameter to `generateReport`
(defaults to the existing "Marketing Performance Report", so every
existing caller is unaffected) so this workflow's reports read as "SEO
Performance Report" in the Reports list rather than reusing the generic
title for unrelated content.

**Rationale:** A dedicated agent gives a genuinely different, valuable
capability - a fast, cheap "just check SEO" analysis (one data source, one
tool-call pair) versus the omnibus agent's full sweep - matching BRD
Section 88's "repetitive SEO research" automation target, and matching
Section 25's explicit intent that SEO get its own agent eventually. BRD
Section 49 ("Full SEO crawler" / "Advanced SEO systems" explicitly out of
scope) is respected: this reads only the already-verified GSC provider's
query/page metrics, never crawls, audits, or infers anything about the
site itself - the prompt is explicit that it must never imply otherwise.

**Trade-off accepted:** live end-to-end verification in this environment
never reaches a real Claude call (no `ANTHROPIC_API_KEY` configured here) -
same pre-existing constraint "Analyze this client" has always had. Verified
live instead via the no-connection path (`runSeoAnalysis` returns early
with `dataGaps` and never calls the AI Gateway when Search Console isn't
connected - fully exercises the workflow, permission gate, UI, and report
generation with zero AI spend) plus full mocked-Claude coverage in
`tests/integration/seo-workflow.test.ts` for the connected/happy path.

**Revisit if:** GA4/GSC ever get a same-request "connect and verify" UI
flow like Metricool's (today GSC connections can only be created via
`connectClientToProviderAccount` directly, no UI form - a pre-existing gap,
not introduced here) - worth noting on the SEO page once it exists, since
right now a staff member has no in-app way to connect Search Console at
all.

---

## 2026-09-10 — Phase 2 "more advanced reporting": period-over-period trends via the previously-unused AnalyticsSnapshot model

**Decision:** Wired up `AnalyticsSnapshot` (present in the schema since Day
1 per BRD Section 69's "every metric should have source/retrieved_at/
period/value/unit", but never actually written to by any code) to add real
period-over-period metric trends to reports - the "Results" piece of BRD
Section 41's client report structure, and the literal "Database/API
metrics → Validated calculations → Claude interpretation → Report"
pipeline Section 68 describes, which the reporting module had never fully
implemented (only "→ Report" existed; there was no separate validated-
calculations step distinct from what Claude said).

- `src/lib/analytics/metrics.ts`: turns each agent's already-gathered raw
  provider data into canonical `{metricName, value, unit, source,
  retrievedAt, period}` rows, source-prefixed (`ga4.sessions`,
  `ads.spend`, `gsc.clicks`, `metricool.reach`) so the same name from two
  providers can never collide. Three deliberate aggregation rules, not
  "sum everything": event/count metrics are summed; rate metrics (CTR,
  CPC, CPA, ROAS, GSC average position) are *recomputed* from the summed
  base metrics rather than averaging pre-computed per-row rates (a classic
  Simpson's-paradox mistake when row sizes differ); `followers` is a
  gauge, so it takes the max observed value, never a sum.
- `src/lib/analytics/snapshots.ts`: `persistAndCompareMetrics` looks up
  the most recent prior snapshot for each client+metric *before* writing
  the new one (order matters - a metric must never be compared against
  the value it's about to become), computes `changePercent`, then
  persists. `null` (not a fabricated number) when there's no prior period
  or the prior value was exactly zero.
- Both `runMarketingAnalysis` and `runSeoAnalysis` now return a `metrics`
  array alongside their existing `AnalysisResult` fields (SEO aggregates
  only from the query-dimension GSC call, not also the page-dimension one
  - both cover the same period's total traffic just grouped differently,
  so summing both would double-count clicks/impressions).
  `generateReport` persists and compares them, attaching the result as
  `ReportContent.trends` - present on both INTERNAL and CLIENT reports
  (Section 41 explicitly wants "Results" in the client-facing report, and
  this is concrete numbers, not AI reasoning, so none of the CLIENT-
  redaction logic needed to change). `generateClientReportFromInternal`
  carries `trends` through unchanged when deriving a CLIENT report.
- New `src/components/ui/trend-list.tsx` renders each trend as a small
  stat card (value + up/down/flat + "% vs prior period"). Deliberately
  never colors a change green/red as if direction alone meant "good" -
  rising CPA or rising average search position are bad, rising clicks or
  sessions are good, and guessing a polarity per metric name isn't worth
  getting subtly wrong; shows the plain number and lets the reader (who
  knows what the metric means) judge it.

A real bug caught by the unit tests, not just the aggregation logic
itself: the first `sum()` implementation defaulted every missing value to
0 before summing, so a metric absent from every row silently came back as
a *reported* zero instead of being omitted - exactly the kind of
fabrication BRD Section 56 forbids. Fixed by having `sum` return
`undefined` (then filtered out entirely) when nothing was actually
reported, split into `sumOptional` (provider fields that can be legitimately
absent) and `sumRequired` (fields the source type guarantees are always
present, e.g. GSC's clicks/impressions) so the "missing" case only has to
be handled where it can actually occur.

**Rationale:** This is the most direct reading of "advanced reporting"
this codebase's own schema and BRD already pointed at - `AnalyticsSnapshot`
existed for exactly this and nothing else, and Section 68's pipeline
diagram is explicit that a report's numbers should come from validated
calculations, not Claude re-describing them. Reusing the metrics an agent
already gathered (rather than a new provider round-trip purely to compute
trends) keeps this free of new tool calls, new audit noise, or new
permission surface.

**Trade-off accepted:** trend comparison is "most recent prior snapshot
for this metric", not "the same-length prior period" - a 30-day report
compared against a 7-day one would still produce a number, just not an
apples-to-apples one. Acceptable for a first pass since every current
caller (`analyze-client-workflow.ts`, `seo-analysis-workflow.ts`) always
uses the same `DEFAULT_RANGE_DAYS`-driven window; would need to become
explicit ("same period length only") if ad hoc custom-range reporting is
ever added.

**Revisit if:** ad hoc/custom-length report ranges are added (tighten the
prior-snapshot lookup to require a comparable period length), or if a
metric needing "good/bad" color-coding becomes valuable enough to justify
a per-metric polarity map in `trend-list.tsx`.

---

## 2026-09-10 — Phase 2: Competitor Agent, an agent with no tools, and the first competitor-management UI

**Decision:** Built the Competitor Agent (BRD Section 25's "Later" agent
list, brought forward as a Section 85 Phase 2 item) plus - a prerequisite
that turned out not to exist - the first UI for managing a client's
competitors at all. `listClientCompetitors`/`addClientCompetitor`
(`src/lib/clients/brain.ts`) have existed since the Client Brain was
built and were already exercised by tests and by `assembleClientContext`'s
`'analytics'` category, but nothing in `src/app` ever called them - a
client's competitors could only be set via a seed script or test factory,
never through the app itself. Added a "Competitors" card (list + add form,
gated by the existing `clients.edit` permission `addClientCompetitor`
already required) to the client detail page.

`src/lib/agents/competitor-agent.ts` is architecturally different from
every other agent in this codebase: it registers with `allowedToolKeys:
[]` and makes zero `executeTool` calls, because there is nothing to fetch
from a provider - competitor data (BRD Section 5's "names, URLs,
positioning, relevant observations") is stored directly on the client, not
pulled live from anywhere. Still registered as a full Agent (BRD Section
26's Agent Contract) purely for the same audit-attribution reason every
other agent is - every AiRun it produces carries `contextIds.agentKey`,
consistent with how every other analysis surfaces. `runCompetitorAnalysis`
reuses `assembleClientContext(ctx, clientId, 'analytics')` (the only
category that already assembles competitors) rather than adding a new
data-gathering path, and returns the same `AnalysisResult` shape as every
other agent - `metrics` is always `[]` (positioning is qualitative, there
is nothing to snapshot as a trend).

`src/lib/workflows/competitor-analysis-workflow.ts` mirrors the SEO/
analytics workflows' persist/route/report/audit pipeline exactly, with one
necessary difference: every other workflow takes a `range: {from, to}`
because performance data is time-boxed; competitor positioning isn't, so
this workflow has no range parameter at all and passes a single-day
"as of today" span to `generateReport` purely because that function's
signature needs *a* period, not because one applies here.

Surfaced in the UI as a third "Run competitor analysis" button on the
client detail page, next to "Run SEO analysis"/"Analyze this client" -
deliberately no new dashboard nav item or aggregate page (unlike Content
Calendar/SEO): BRD Section 42's dashboard nav list has no "Competitors"
entry, and BRD frames competitors as part of the Client Brain, not a
standalone module - the client detail page (where Policy/Integrations/
Content calendar already live) is the right home.

5 new tests (215 total, up from 210) in `tests/integration/
competitor-workflow.test.ts`: agent registration with an empty tool
allowlist, the full analysis pipeline (confirms the stored competitor's
name/positioning actually reach the prompt), the no-competitors/no-AI-
spend path, the end-to-end workflow (persist + route + a distinctly-titled
report), and the `analysis.trigger` permission gate. Competitor CRUD
permission behavior itself was already covered by existing tests
(`client-brain-crud.test.ts`, `context-router.test.ts`, the Section 80
adversarial suite) - not re-tested here. All 210 pre-existing tests pass
unchanged.

**Rationale:** Reused every established pattern (permission-per-action via
existing permissions - no new one needed here, `getOwnedX`-style ownership
checks already built into `addClientCompetitor`/`listClientCompetitors`,
the aggregate-page-owns-actions/detail-page-owns-creation split, the
shared `AnalysisResult`/`generateReport` pipeline) rather than inventing
new ones. The empty-tool-allowlist agent is a deliberate, documented
departure from the Analytics/SEO agents' shape, not an oversight - it's
the correct shape for an agent whose only input is already-stored data.

**Trade-off accepted:** no UI to *edit* or *delete* a competitor record
once added, only add + list (matching what `src/lib/clients/brain.ts`
itself supports today - `addClientCompetitor` only creates). Acceptable
for a first pass since the underlying BRD capability ("Competitors: names,
URLs, positioning, relevant observations") is satisfied; edit/delete would
need new lib functions before any UI for them makes sense.

**Revisit if:** edit/delete support is added to `brain.ts` (extend the
Competitors card with those actions then), or if BRD Section 49's Phase 3
"Advanced competitive intelligence" ever gets scheduled - that would be a
genuinely different, larger capability (live-fetched competitor data),
not an extension of this agent.

---

## 2026-09-11 — Phase 2: automated social scheduling (`metricool.publish_post`), and a real Approval Engine execution gap found along the way

**Decision:** Closed the "Automated social scheduling" Phase 2 item
(BRD Section 85) by adding the real publish step that the content-calendar
work (2026-09-10 above) deliberately left out: `metricool.publish_post`
(`src/lib/integrations/metricool/tools.ts`), a HIGH-risk Tool Registry
entry per BRD Section 21's "Publish content" row, gated on `content.manage`.
Its real adapter stays `UnsupportedOperationError` for the same reason
every not-yet-live-verified Metricool write does in this codebase
(`METRICOOL_MCP_URL` is unset in every environment this has run in) - the
mock provider (`mock-provider.ts`) fully implements it, and the whole
feature is built and verified against the mock, same as everything else
in this integration so far.

`publishContentCalendarItem` (`src/lib/content-calendar/persist.ts`,
`SCHEDULED -> SCHEDULED-with-a-pending-approval`) calls it through
`executeTool` and catches `ApprovalRequiredError` specifically - a HIGH-
risk tool never executes on a fresh call, so this always throws, and
catching only that error (not swallowing anything else) records the new
`approvalId` on the item while leaving its status untouched. The item
itself never gets a new "publish requested" status - it's still exactly
what it was, `SCHEDULED`, just now also waiting on a human. A second
publish request while one is already pending is refused outright
(`"A publish request is already pending approval for this item."`), not
silently creating a second approval for the same item.

**A real, previously-undiscovered gap found and fixed while wiring the
"Approve" button to actually publish:** nothing in the running app ever
called `executeApprovedTool` after an approval was approved.
`approveApproval` (`src/lib/approvals/approvals.ts`) only ever flipped an
`Approval` row's `status` to `APPROVED` in the database - the HIGH/
CRITICAL-risk tool call it was gating never actually ran, for *any*
approval in this codebase, not just this new one. Every approval anyone
had ever clicked "Approve" on up to this point was, from the tool's point
of view, still un-executed. Found the same way the Tool Registry bootstrap
gap was found on 2026-09-10: grepping for callers of a function
(`executeApprovedTool`) and finding none outside test files. Fixed
generically with `approveAndExecuteApproval` (`src/lib/tools/execute.ts`,
not `approvals.ts` - `execute.ts` already imports from `approvals.ts`, so
adding it there avoids a circular import): approves, then - only if the
approval's `proposedChanges` actually carries a `toolKey` (a routed
recommendation's approval doesn't) - executes it via the existing
`executeApprovedTool` path, marking the approval `EXECUTED` or `FAILED`.
`approveApprovalAction` (`src/app/dashboard/actions.ts`) now calls this
instead of bare `approveApproval`. This benefits every present and future
HIGH/CRITICAL tool gated by the Approval Engine, not just this one.

Because there's still no generic "approval resolved -> notify the thing
that requested it" mechanism in this codebase (a routed `Recommendation`'s
`status` doesn't sync from its own approval's outcome either - checked
before building this), the content-calendar item's own PUBLISHED
transition needed a small, explicit, content-calendar-specific
reconciliation step rather than a new general pattern:
`syncContentCalendarItemFromApproval` (`persist.ts`), called from the
Server Action layer right after `approveAndExecuteApproval`/
`rejectApproval`. It's a no-op for any approval not linked to a content
item (looked up by the item's own `approvalId`, a field the schema already
had and nothing previously used). `EXECUTED` -> item `PUBLISHED`;
`FAILED`/`REJECTED` -> `approvalId` cleared so a retry isn't blocked by the
"already pending" guard, item stays `SCHEDULED` rather than a new `FAILED`
status (an integration failure or a reviewer's rejection isn't a
disqualification of the content itself - see the same reasoning already
applied to `scheduleContentCalendarItem` on 2026-09-10).

Surfaced in the UI as a "Publish" button on `SCHEDULED` items on the
Content calendar page, swapped for a "waiting on approval" message (linking
to `/dashboard/approvals`) once a request is pending - no new page.

7 new tests (222 total, up from 215) in `tests/integration/
social-publish-workflow.test.ts`: the HIGH-risk gate always throwing
`ApprovalRequiredError` on a fresh call, `publishContentCalendarItem`'s
approval-recording and double-request guard, the full loop (approve ->
actually executes the tool, proven against the mock provider's own post
status via a follow-up `metricool.get_posts` call, not just the `Approval`
row -> syncs the item to `PUBLISHED`), reject-then-retry clearing
`approvalId`, a non-tool-call approval staying `APPROVED`-only exactly as
before this change, and the two permission-denial cases
(`marketing_employee` can request but not approve; `client_user` can't
even request). Live-verified end-to-end in the browser: connected a client
to Metricool, created/submitted/approved/scheduled a content item as
`super-admin`, clicked "Publish" (item stayed `SCHEDULED` with the
pending-approval message), saw the PENDING HIGH-risk approval on
`/dashboard/approvals`, clicked "Approve" (flipped to `EXECUTED`), and
confirmed the content item then showed `PUBLISHED`. All 222 tests pass;
`npm run build` still produces 19 routes (no new page added).

**Rationale:** The publish tool follows the exact shape every other
HIGH-risk write in this codebase already uses - no new risk-classification
mechanism, no new authorization path. The Approval Engine fix was in-scope
rather than deferred, same call made for the Tool Registry bootstrap gap:
shipping a "Publish" button that creates approvals nothing ever executes
would be strictly worse than not shipping it, and the fix is generic, so
it isn't scoped narrowly to this one feature. The sync step deliberately
stays small and content-calendar-specific rather than growing into a new
"generic approval callback" concept invented under time pressure for one
caller - `Recommendation` living with the same limitation today is the
precedent for not over-building this.

**Trade-off accepted:** no automatic retry or scheduled re-attempt if a
publish approval is rejected or fails - a human has to click "Publish"
again from the content calendar. Acceptable since the BRD's automated-
scheduling requirement is about the schedule-then-publish pipeline
existing with the right approval gate, not about self-healing retries.

**Revisit if:** a second caller needs "approval resolved -> notify
origin" (at which point generalizing `syncContentCalendarItemFromApproval`
into a real mechanism - and finally wiring `Recommendation.status` the
same way - becomes worth it instead of a second one-off), or when
`METRICOOL_MCP_URL` is actually configured somewhere and the real
adapter's `publishPost` can be implemented and live-verified against
Metricool itself instead of staying `UnsupportedOperationError`.

---

## 2026-09-11 — Phase 2: native Google Ads / Meta Ads integration, closing the ad-management-write gap

**Decision:** Closed the "ad management (write)" gap `docs/INTEGRATIONS.md`
documents as confirmed unavailable via Metricool ("No adapter write path
exists; would need a native Google/Meta Ads integration (Phase 2) if ever
required") - the Metricool MCP server has no ads write endpoints at all, a
capability gap in the MCP itself, not an account-plan restriction. BRD
Section 51's "Native Ads API Strategy" is explicit that this is exactly
when a native adapter belongs: "only when Metricool lacks a required
operation... behind the same AdsProvider interface, so agent code is
unchanged." `AdsProvider` (`src/lib/integrations/providers.ts`) already
had that full interface, unused by any provider until now.

Added two new provider modules, `src/lib/integrations/google-ads/` and
`src/lib/integrations/meta-ads/`, identical in shape (mock-provider.ts /
provider.ts / index.ts / tools.ts / connect.ts / README.md - see either
README for the full file-by-file breakdown) - `IntegrationProvider` already
had `GOOGLE_ADS`/`META_ADS` enum values sitting unused since Day 1's
schema, and `IntegrationAccount`/`IntegrationConnection` are already fully
provider-generic, so no migration was needed at all.

**`GoogleAdsMockProvider`/`MetaAdsMockProvider`** (BRD Section 92 names
both explicitly) are full, real, deterministic implementations - what every
new tool, test, and (once connected) agent actually exercises.
`createCampaign` always returns a `PAUSED` campaign, mirroring
`MetricoolMockProvider.schedulePost`'s `draft: true` safety rule: BRD
Section 21 classifies "create draft campaign" MEDIUM but "launch campaign"
HIGH, so a freshly created campaign is never live by default - actually
enabling one is a separate, HIGH-risk `update_campaign` call.

**Nine new Tool Registry entries per provider** (`google_ads.*`/
`meta_ads.*` - `get_campaigns`/`get_campaign_performance`/`get_ad_groups`/
`get_ads` LOW, `create_campaign`/`pause_campaign` MEDIUM, `update_campaign`/
`update_budget`/`update_bid` HIGH, per BRD Section 21's verbatim examples)
gated on a new `ads.manage` permission (`src/lib/rbac/permissions.ts`) for
every write - reads reuse the existing `clients.read` everyone already
holds, same split as `content.manage`. Unlike `content.manage`, `ads.manage`
is granted to `account_manager` only, not `marketing_employee`: BRD 4.3's
Marketing Employee capability list stops at "Analyze campaigns" (read),
while 4.2's Account Manager gets the broader "Manage assigned clients" -
this is a deliberate difference from the social-scheduling precedent, not
an oversight.

**The real adapters (`createGoogleAdsProvider`/`createMetaAdsProvider`)
throw `UnsupportedOperationError` for every method** - a departure from how
GA4/GSC's real adapters were built (real, if not-live-verified,
implementations against the official `googleapis` client already used
correctly elsewhere in this codebase). The reasoning differs by platform
but lands the same place for both:
- **Google Ads**: there is no official Node.js client at all - Google's own
  published client-library list covers Java/.NET/PHP/Python/Perl/Ruby, not
  Node. Writing a bespoke REST/GAQL client against an unverified protocol
  shape (developer-token headers, resource names, mutate-operation
  envelopes) would mean guessing exact wire formats with nothing in this
  environment to check them against.
- **Meta Ads**: an official SDK does exist (`facebook-nodejs-business-sdk`)
  but is deliberately not added as a dependency - it isn't installed and
  its API surface can't be inspected from this environment, and there's no
  Meta developer app/app review/test account to verify calls against
  either way (BRD Section 54). Adding an unverified dependency and writing
  unverifiable calls against it isn't meaningfully safer than guessing a
  raw protocol.

Both land on the same choice already made for `metricool.publish_post`'s
real adapter: CLAUDE.md rule 5/BRD Section 15/116 rule out fabricating an
implementation that can't be verified - stub clearly, document why, track
in `docs/EXTERNAL-APPROVALS.md` (Google Ads' existing row updated from "not
needed for MVP" to reflect this is now built against the mock; a new Meta
Ads row added). `resolveGoogleAdsProvider`/`resolveMetaAdsProvider` still
check an env var and fall back to the mock, matching GA4/GSC's resolution
shape exactly, even though the real path always fails today - so a future
real implementation slots in without touching any call site.

**Connect flow deliberately mirrors Metricool's single-step
connect-and-verify, not GA4/GSC's OAuth flow.** GA4/GSC's OAuth building
blocks (`buildGoogleAuthUrl`/`exchangeGoogleAuthCode`,
`src/lib/integrations/google/oauth.ts`) were built on Day 7 but never
wired to any route or UI - no real Google Cloud OAuth app exists to
complete a flow against, and neither integration has a "Connect" button
today either (`docs/INTEGRATIONS.md`). Replicating that same unexercised
OAuth scaffold for a similarly-credential-less Google Ads connection would
add a second unused flow rather than a working one, so
`connectClientToGoogleAdsAccount`/`connectClientToMetaAdsAccount` instead
follow Metricool's shape: store the external account id, verify with a
real call to the (mock, today) provider, mark CONNECTED only on success -
gated on `integrations.manage`, same permission Metricool's connect flow
uses. Surfaced as two new forms on the client detail page's existing
Integrations card, next to the Metricool one - no new dashboard page.

**Deliberately NOT done in this pass:**
- **No UI for the write tools** (create/pause/update campaign, budget, bid).
  BRD Section 20's own workflow example ("Reduce budget on campaigns with
  CPA 50% above target") frames these as something an agent does via
  natural-language instruction through the Tool Registry + Approval Engine,
  not something a human clicks a dashboard button for - building bespoke
  CRUD forms would be less faithful to that design than leaving them
  agent/tool-callable only, matching how Metricool's own equivalent
  `get_ad_campaigns`/`get_ad_performance` tools have never had dedicated
  read UI either.
- **The Marketing Analytics Agent's gather step was not changed** to
  dynamically pull from whichever ads providers (Metricool vs. native) are
  actually connected for a client - it still only ever calls
  `metricool.get_ad_campaigns`/`get_ad_performance`. Wiring that up needs a
  new "which ad providers does this client have" resolution step the agent
  doesn't have today; adding `google_ads.*`/`meta_ads.*` to its
  `allowedToolKeys` without a gather-step change to actually call them
  would just be dead configuration. Left as a distinct follow-up rather
  than done as a side effect of this change.
- **`ClientPolicy.maxDailyAdBudget`/`maxBudgetChangePercent`/
  `autoChangeAds`** are still not consulted anywhere - same gap already
  noted in the 2026-09-10 content-calendar entry's "Revisit if", still
  true here: no module in this codebase makes tool execution conditional
  on a `ClientPolicy` field yet.

30 new tests (252 total, up from 222): 16 unit tests in `tests/unit/
native-ads-providers.test.ts` (`describe.each`-parametrized across both
providers - full mock CRUD round trip including the always-PAUSED
`createCampaign` rule, plus both real adapters' every method throwing
`UnsupportedOperationError`), 14 integration tests in `tests/integration/
native-ads-tools.test.ts` (same `describe.each` parametrization - the
connect flow, reads working for any `clients.read` role down to
`client_user`, `IntegrationUnavailableError` for a disconnected client,
`create_campaign` executing directly for `account_manager` and always
PAUSED, MEDIUM/HIGH tools denied outright for `marketing_employee`/
`client_user` (no `ads.manage`), and the full `update_budget`
approve-and-execute loop - proven against the mock provider's actual
budget value via a follow-up `get_campaigns` call, not just the `Approval`
row). All 222 pre-existing tests pass unchanged.

End-to-end smoke-verified live with Playwright: connected Client A to both
a mock Google Ads customer id and a mock Meta Ads account id through the
new client-detail-page forms, confirmed both show `CONNECTED` in the
Integrations card, cross-checked directly against the database
(`externalAccountId`/`label`/`status`/`lastSuccessfulSyncAt` all correct
for both). Along the way, found and fixed a real login-flow bug in the
verification script itself (not an app bug): the sign-in page's
`handleSubmit` calls next-auth's `signIn()` then does its own
`window.location.href` navigation once that resolves - a plain
click-then-`waitForLoadState('networkidle')` races that async handler,
since the click event returns before `signIn()`'s own fetch completes.
Fixed by waiting for the actual URL change away from `/sign-in` instead;
confirmed via a raw `curl` cookie-jar test that the credentials/session
mechanism itself was never broken, only the script's timing assumption
was. Fixture data and scratch scripts removed afterward.

typecheck, lint, full test suite (252/252), and production build (19
routes, unchanged - only two new forms on an existing page) all pass.

**Rationale:** Every new provider module reused an established pattern
exactly (GA4/GSC's `resolve*Provider`/README shape, Metricool's
connect-and-verify shape and mock-provider structure, the existing
`AdsProvider` interface and its zod schemas) rather than inventing new
ones - `src/lib/integrations/ads-schemas.ts` is the one genuine
refactor, extracting `AdCampaignRecordSchema`/`AdCampaignPerformanceSchema`
(previously private to `metricool/tools.ts`) plus two new schemas
(`AdGroupRecordSchema`/`AdRecordSchema`) into a shared module so three
providers don't each redefine the same four shapes - pure refactor, no
behavior change, same reasoning as extracting `src/lib/agents/schemas.ts`
off the Analytics Agent when the SEO Agent needed it too. The
`UnsupportedOperationError` choice for both real adapters, while a
departure from GA4/GSC's precedent, is itself precedent-following - it's
the exact same choice already made for `metricool.publish_post`'s real
adapter, for the same reason (no way to verify an implementation in this
environment), just now applied because *no* verified client library
exists for either platform, not just one unverified operation.

**Trade-off accepted:** the native integrations exist and are fully
tool-callable/tested against the mock, but nothing in the app's agent
layer automatically uses them yet (see "Deliberately NOT done" above) -
connecting a client to Google Ads/Meta Ads today only unlocks manual
tool calls (e.g. from a future command layer, BRD Section 44) or direct
`executeTool` use, not an automatic boost to what "Analyze this client"
covers.

**Revisit if:** real Google Ads/Meta Ads credentials become available
(implement the real adapters behind the unchanged interface, per BRD
Section 51), a second caller needs the Marketing Analytics Agent to read
native ads data (wire the gather-step's provider-discovery logic then,
not speculatively now), or `ClientPolicy`-driven risk/approval logic gets
built for any module (the natural point to wire `maxDailyAdBudget`/
`maxBudgetChangePercent`/`autoChangeAds` into `update_budget`/
`update_campaign`'s authorization, same "Revisit if" carried forward from
2026-09-10).

---

## 2026-09-11 — Phase 2: Canva creative workflow, and a real AI Gateway bug found along the way

**Decision:** Built the Canva creative workflow (BRD Section 17/47/55/67/
85/112/121 - "Create three Instagram creative concepts for Client A based
on the recommended campaign"), the last item from BRD Section 50's
**Phase 1** roadmap ("Canva MCP where available") that had never shipped -
tracked here under Phase 2 because that's when it was picked up, not
because the BRD scoped it there.

Added `CreativeProvider` to `src/lib/integrations/providers.ts` (BRD
Section 17's operation list: create/edit/search designs, search assets,
export) and a new `src/lib/integrations/canva/` module, same shape as
every other provider: `CanvaMockProvider` (BRD Section 92) is the full,
real, deterministic implementation everything actually exercises;
`createCanvaProvider()` (the real adapter) throws
`UnsupportedOperationError` for every method - unlike GA4/GSC's real
adapters (built against the official, already-verified-elsewhere
`googleapis` client), no Canva MCP connection has ever been available in
this environment to check tool names/schemas against, so nothing was
guessed (same choice already made for `metricool.publish_post` and the
native Ads providers' real adapters, for the same reason - see the
2026-09-11 native-ads entry above). BRD Section 55's four Canva
connectivity states (connected/not connected/authorization expired/
unavailable) map directly onto the existing generic `IntegrationHealth`
enum - no new state machine needed. Connect flow
(`connectClientToCanvaAccount`) mirrors Metricool/Ads' single-step
connect-and-verify, not GA4/GSC's OAuth flow, which was built but never
wired to any route/UI either - see `google-ads/connect.ts`'s doc comment,
reused verbatim here.

Five new Tool Registry entries (`canva.search_designs`/`search_assets`
LOW on `clients.read`; `canva.create_design`/`edit_design`/`export_design`
MEDIUM on a new `creative.manage` permission - BRD Section 21's MEDIUM
examples list "Generate creative" explicitly, distinct from "Publish
content" HIGH, since a Canva design is never customer-facing by itself).
`creative.manage` is granted to **both** `account_manager` and
`marketing_employee` - unlike `ads.manage` (account_manager only), BRD
4.3 explicitly lists "Generate creative briefs"/"Generate content" for
Marketing Employee, so this follows `content.manage`'s broader grant
shape instead.

**The Creative Agent** (`src/lib/agents/creative-agent.ts`) is
architecturally closer to the Competitor Agent than the analysis agents:
`allowedToolKeys: []`, it never calls Canva itself - it only generates
creative CONCEPTS (title/copy/visual description), a genuinely different
structured shape (`CreativeBriefResultSchema`) from every other agent's
`AnalysisResultSchema`/`RecommendationSchema`. Actually creating the Canva
design for an already-drafted concept is a separate step
(`generateCreativeDesign`, `src/lib/creative/persist.ts`, calling
`canva.create_design` directly) - BRD Section 47's flow ("Claude creative
concepts → Canva MCP → Design creation/editing") is explicitly two
separate steps, mirroring how `scheduleContentCalendarItem` calls
`metricool.schedule_post` directly rather than through an agent. Uses the
`content` Context Router category (`business`/`audience`/`brand` sections)
and the `content` prompt category (`prompts/content/v1.md`) - **both
already existed in this codebase, unused by any agent until now**,
clearly built in advance for exactly this feature.

**"Brand validation"** (BRD Section 47's flow step) is folded into the
structured output itself (`brandAligned`/`brandNotes` per concept) rather
than a separate procedural gate - Claude already has the full brand
context in front of it while generating each concept. This is advisory,
not enforcement: a `brandAligned: false` concept still reaches
`IN_REVIEW`/`APPROVED` like any other if a human approver accepts it -
agents never gate approvals themselves (BRD Section 19).

**`src/lib/workflows/creative-workflow.ts`** is the first agent workflow
in this codebase that does NOT persist `Recommendation` rows, route them
to a `Task`/`Approval`, or produce a `Report` - it persists `CreativeAsset`
rows directly instead (`src/lib/creative/persist.ts`'s own
`DRAFT -> IN_REVIEW -> APPROVED/REJECTED` lifecycle, simpler than
`ContentCalendarItem`'s - no `SCHEDULED`/`PUBLISHED`/`CANCELLED`, since a
creative asset doesn't get scheduled/published itself). Once `APPROVED`,
the natural next step (BRD's "...→ Approval → Metricool scheduling") is
attaching it to a `ContentCalendarItem` via that item's existing
(previously unused) `creativeAssetId` field - a human picks the approved
creative from a new dropdown on the "Add to calendar" form; this module
deliberately does not auto-create a content item (same "no new automatic
wiring" discipline as the competitor-analysis and native-ads phases).

New `/dashboard/creatives` aggregate page (status-transition actions
across every client, same split as Content calendar/Recommendations/
Tasks) plus a "Creatives" card + Canva connect form on the client detail
page, and a "Creatives" nav item - the dashboard layout's own comment had
flagged this as "added when \[its\] underlying module exists" since Day
13/14; it does now.

**A real, previously-undiscovered bug found and fixed while live-verifying
this feature:** `runStructuredAiTask`'s (`src/lib/ai/gateway.ts`)
`getAnthropicClient()` call sat *after* the `ai_runs` row was created
(status `RUNNING`) but *outside* the retry loop's own try/catch - if it
throws synchronously (`ANTHROPIC_API_KEY` not configured), the row was
left permanently stuck at `RUNNING`, never marked `FAILED`. Not caught by
any of this session's prior live verifications because every other agent
workflow (Analytics/SEO/Competitor) has a "no data source connected"
short-circuit that returns *before* ever calling `runStructuredAiTask` -
the exact no-API-key path this environment always hits. The Creative
Agent has no such short-circuit (Client Brain context is always
structurally present, never an external dependency that can be "down"),
so it's the first caller in this codebase to actually reach that line
without a real key configured - caught live in the browser (the "AI
runs" card showed two rows stuck at `RUNNING` after the expected
no-API-key failure) and confirmed directly against the database before
being fixed. Fix: wrap `getAnthropicClient()` in its own try/catch that
marks the row `FAILED` with the real error before rethrowing - same
error-recording shape the retry-exhaustion path already used. A new test
(`tests/integration/ai-gateway.test.ts`) exercises the real
`getAnthropicClient()` (no injected fake client) to lock this in.

8 new tests in `tests/unit/canva-providers.test.ts` (mock provider's full
`CreativeProvider` round trip, real adapter's `UnsupportedOperationError`),
5 in `tests/integration/canva-tools.test.ts` (Tool Registry + permission
gating, notably `marketing_employee` *can* call the write tools here
unlike native Ads), 10 in `tests/integration/creative-workflow.test.ts`
(agent registration, prompt/context assembly proof, the full generate→
persist pipeline, the failure path leaving no partial `CreativeAsset`
rows, the full submit/approve/reject lifecycle, `generateCreativeDesign`
attaching a design without changing status, and BRD Section 121's "fail
gracefully, preserve the brief" - proven by asserting the `CreativeAsset`
row is byte-for-byte unchanged after a Canva-unavailable failure), plus 1
in `tests/integration/ai-gateway.test.ts` for the gateway fix above - 276
total (up from 252 before this entry - the native-ads phase's own 30
tests are already counted in that 252). All pre-existing tests pass
unchanged.

End-to-end smoke-verified live with Playwright: connected Client A to a
mock Canva brand id (confirmed `CONNECTED`), clicked "Generate concepts"
and confirmed it fails gracefully with the expected
`ANTHROPIC_API_KEY is not configured` error and creates zero `CreativeAsset`
rows (verified against the database, not assumed) - this environment has
no `ANTHROPIC_API_KEY`, the same pre-existing constraint every other agent
workflow has had throughout this session, so the connected/happy
generation path is covered by the mocked test suite instead. Seeded one
`DRAFT` creative directly (bypassing the AI call, same technique used
whenever a live click can't reach an AI-gated path in this sandbox) and
confirmed the rest of the pipeline for real: "Generate Canva design"
attached a real mock `designUrl`, submit → approve reached `APPROVED`, and
the approved creative then appeared in the content calendar's new
"Creative" dropdown on the client page - each step cross-checked directly
against the database or DOM, not just a screenshot, after two of the
intermediate screenshots turned out to be the same stale-render timing
artifact already diagnosed in the social-scheduling phase (confirmed via
direct DB query, not assumed). Fixture data and scratch scripts removed
afterward; the two stuck `RUNNING` `AiRun` rows from the no-API-key clicks
were also cleaned up (not left as apparent live evidence of the very bug
just fixed).

typecheck, lint, full test suite (276/276), and production build (20
routes - `/dashboard/creatives` is the only new one) all pass.

**Rationale:** Every new module reused an established pattern exactly
(the `resolve*Provider`/README shape, the connect-and-verify shape, the
Tool Registry risk-classification discipline, the aggregate-page-owns-
actions/detail-page-owns-creation split) - the two genuinely new shapes
(the Creative Agent's non-`AnalysisResult` output, the creative workflow's
no-Recommendation-routing pipeline) are deliberate, documented departures
where BRD Section 67's `CreativeAsset` entity is genuinely a different
kind of thing than a `Recommendation`, not oversights. Fixing the AI
Gateway bug in-scope (rather than filing it away) matches this session's
standing discipline (the Tool Registry bootstrap gap, the Approval Engine
execution gap): a bug found while shipping a feature gets fixed as part of
that feature, especially one this fundamental (every future agent that
lacks a short-circuit guard would have hit it too).

**Trade-off accepted:** no UI for a human to manually pick which Canva
brand asset to reuse in a design (`canva.search_assets` exists as a tool,
callable by a future command-layer/agent, but nothing in the dashboard
surfaces a picker for it) - BRD Section 17's "Access brand assets" is
satisfied at the tool layer, a browsing UI for it would be new scope
beyond the MVP creative workflow this phase targets.

**Revisit if:** a real Canva MCP connection becomes available (implement
the real adapter behind the unchanged interface - see the file's own doc
comment for the intended shape, reusing `@modelcontextprotocol/sdk`'s
already-proven Metricool pattern), a second workflow needs the same
"generate, don't route to Recommendation" shape (generalize rather than
one-off), or a second agent is built without a Marketing-Analytics-style
data-availability short-circuit (re-check it doesn't hit the same class
of gap the AI Gateway fix above closes for the general case, not just this
one caller).

---

## 2026-09-11 — Phase 2: weekly automated intelligence (Redis/BullMQ), closing the Phase 2 backlog

**Decision:** Implemented BRD Section 65's scheduled automation - the last
item on BRD Section 85's Phase 2 backlog, and the only one named as a
specific cadence: "Weekly automated intelligence." This is also the first
feature in this codebase that needs infrastructure beyond the Next.js app
itself: `docs/ARCHITECTURE.md`'s stack table has said "Redis + BullMQ"
since Day 1, unused until now.

**A real local Redis was available in this sandbox** (unlike every other
"not live-verified" credential this session), so this was built and
tested against genuinely working queue infrastructure, not a mock -
`bullmq`+`ioredis` added as real dependencies (`npm view` confirmed
registry reachability; neither introduces any new `npm audit` finding -
checked directly). A real end-to-end test
(`tests/integration/weekly-intelligence.test.ts`) spins up an actual
BullMQ `Worker` against actual Redis and asserts a job completes - the
strongest infrastructure test in this codebase.

**Deployment topology - two processes, not one.** Vercel serverless
functions return after each request; there is no "keep polling Redis in
the background" primitive there, so BullMQ's `Worker` (a long-lived
polling loop) cannot run inside the Vercel-hosted app. Split accordingly:
`src/app/api/cron/weekly-intelligence/route.ts` is the fast, stateless
half (find who's due, enqueue, return) that fits a serverless function,
triggered by Vercel Cron (`vercel.json`, weekly) and gated by a
`CRON_SECRET` bearer header (Vercel's own documented pattern - without it,
anyone finding the URL could trigger paid AI workflows for every opted-in
client). `scripts/worker.ts` is a separate, standalone entrypoint
(`npm run worker`) that actually processes jobs - documented as needing a
small always-on host (Railway/Render/Fly.io/a VM), never Vercel. This is
the realistic, commonly-used pattern for "Vercel app + BullMQ," not a
compromise unique to this codebase.

**`resolveAutomationActor`** (`src/lib/queue/resolve-actor.ts`) is the
answer to "who does an unattended job act as?" - BRD Section 4.5: "An AI
agent is not a user... may only access tools and clients explicitly
permitted." Rather than inventing a new service-account concept (a new
User row with no login, a new role, a new migration), a scheduled run
resolves the client's own assigned `account_manager` (falling back to an
assigned `marketing_employee`) and runs `runAnalyzeClientWorkflow`
**unchanged** - the exact same function a human triggers by clicking
"Analyze this client," with the exact same full authorization/tenant/
permission chain (`docs/SECURITY.md` invariant 2 - no bypass for
unattended callers). A client with nobody eligible assigned is skipped (a
`DENIED` audit event), never run under a fabricated actor - `resolveAuthContext`
never gets called with a made-up userId.

**Why the same workflow, not a new one.** `processWeeklyIntelligenceJob`
(`src/lib/queue/weekly-intelligence-worker.ts`) calls
`runAnalyzeClientWorkflow` directly - a scheduled run is not a different
*kind* of analysis, just a different trigger source. Every `AiRun`/
`WorkflowRun`/`Recommendation`/`Report`/audit row it produces is therefore
indistinguishable in shape from a human's manual trigger - deliberately,
so nothing downstream (dashboard, approvals, reporting) needs to
special-case "was this automated." One consequence, also deliberate: the
weekly idempotency check (`findClientsDueForWeeklyIntelligence` - no
`SUCCEEDED` `analyze_client_performance` `WorkflowRun` in the last 7 days)
also skips a client a human happened to analyze manually within the
window - not a bug, just "don't spend AI budget redundantly, regardless
of who asked."

**Opt-in, never global** (BRD Section 65 explicit requirement): a new
`ClientPolicy.weeklyAutomationEnabled` column (one-line migration,
`prisma/migrations/20260911075315_add_weekly_automation_policy/`),
defaulting `false`. This is also the first UI ever built for editing
`ClientPolicy` at all - `updateClientPolicy` existed since Day 8 with no
caller in `src/app`; a small checkbox+Save form was added to the client
detail page's existing Policy card (gated on `clients.edit`, same
permission `updateClientPolicy` itself requires) rather than a full policy
editor - matches this session's "small, single-purpose" discipline (e.g.
the native-ads/Canva connect forms), not a rebuild of the whole card.

**Weekly-only scope, deliberately.** BRD Section 65 lists Daily
(performance anomaly check), Weekly (marketing performance summary,
recommendations, social content planning), and Monthly (client report,
strategy recommendations) - but Section 85's Phase 2 backlog names only
"Weekly automated intelligence." Daily would mean building real anomaly
detection (a genuinely new capability, arguably Phase 3 "Autonomous
Optimization" territory per BRD Section 49/50) and Monthly is closely
served by the same `runAnalyzeClientWorkflow`/report pipeline already
built - neither was invented speculatively. `src/lib/queue/
weekly-intelligence-queue.ts`'s own doc comment flags this: generalize
into per-cadence queues once a second cadence is actually scheduled, same
"generalize on second real caller" discipline as `src/lib/workflows/
runs.ts`'s own `WorkflowRun`/`WorkflowStep` tracker.

**A real bug found and fixed while building this, in code written this
same session:** BullMQ rejects a custom `jobId` containing `:` - the first
version of `enqueueWeeklyIntelligenceJob` used `<clientId>:<ISO week>` and
every enqueue call threw immediately (`Custom Id cannot contain :`),
caught by the very first test run against the real queue. Fixed by
switching the separator to `-`. Not a subtle bug and not something a mock
queue would ever have caught - direct evidence for why this feature was
built against real Redis rather than mocked.

**Extracted `DEFAULT_RANGE_DAYS`/`DEFAULT_SOCIAL_NETWORK`/
`DEFAULT_ADS_CHANNEL`** (previously private to `src/app/dashboard/
actions.ts`) into `src/lib/workflows/defaults.ts` - the weekly worker
needed the same MVP placeholder defaults the "Analyze this client" button
uses. Pure refactor, no behavior change, same "extract on second use"
discipline as `src/lib/integrations/ads-schemas.ts`.

15 new tests (288 total, up from 276): 12 in `tests/integration/
weekly-intelligence.test.ts` (`resolveAutomationActor`'s account_manager-
preferred/marketing_employee-fallback/null-when-nobody-assigned logic,
`findClientsDueForWeeklyIntelligence`'s opt-in + idempotency-window
filtering including the SUCCEEDED-vs-FAILED distinction,
`processWeeklyIntelligenceJob`'s real run + its graceful DENIED-audit skip
path, and a real BullMQ enqueue/dedup/Worker-processes-a-real-job round
trip against real Redis), 3 in `tests/integration/
cron-weekly-intelligence.test.ts` (the route's `CRON_SECRET` gate, that it
actually enqueues due clients, that an opted-out client is never
touched). All pre-existing tests pass unchanged.

End-to-end smoke-verified live against real infrastructure (not a
bypass): seeded, started the dev server, real local Redis, real Postgres.
Toggled "Weekly automated intelligence" on for Client A through the new
checkbox on the live client detail page (confirmed persisted in the
database), called the real cron route on the live running dev server via
`curl` with the real `CRON_SECRET` (exactly as Vercel Cron would),
confirmed it enqueued the client into the real Redis queue, then ran
`npm run worker` for real against that queue - it picked up the job,
resolved the correct actor (`employee@targetgum.dev`, the only staff
assigned to Client A in this seed - no `account_manager` exists in this
seed at all, so the fallback path was exercised live, not just in tests),
and ran the full `runAnalyzeClientWorkflow` end-to-end, producing a real
"Marketing Performance Report" visible on the client's Reports card in the
browser - zero AI spend (Client A has no integrations connected in this
seed, so the Marketing Analytics Agent's existing "no data source
connected" guard short-circuited before any Claude call, the same
zero-fabrication behavior verified for every other agent workflow this
session). Demo data, the scratch verification script, and the generated
report/workflow rows were cleaned up afterward; the policy toggle was
reset to `false`; a stray `dump.rdb` (a local Redis persistence snapshot,
written to the working directory by `redis-server --daemonize yes`) was
removed and `*.rdb` added to `.gitignore` so this can't happen again.

typecheck, lint, full test suite (288/288), and production build (20
routes - `/api/cron/weekly-intelligence` is the only new one) all pass.

**Rationale:** Every new module reused an established pattern
(`resolve*Provider`-style lazy singletons for the Redis connection, the
processor-logic-factored-out-for-testability split already used by
`src/lib/tools/execute.ts`, the "reuse the existing authorization chain,
never invent a parallel one" discipline already applied everywhere in this
codebase) rather than inventing new ones. The two genuinely new pieces -
a second deployable process, and resolving an unattended actor from
existing staff assignments rather than a new account type - are both
directly required by the problem ("run this without a human clicking
anything, on a schedule, on a platform that can't host a background
worker") and both documented in depth (`docs/ARCHITECTURE.md` §4a,
`docs/SECURITY.md`) rather than left implicit.

**Trade-off accepted:** Daily/Monthly cadences are not built (see "Weekly-
only scope" above) - `weeklyAutomationEnabled` is a single boolean, not a
per-cadence settings object, so adding a second cadence later needs its
own `ClientPolicy` column and its own queue, not a trivial extension of
this one. The worker process is a genuinely new piece of infrastructure
to operate (a persistent host, not just "deploy to Vercel and done") -
accepted because BRD Section 65 explicitly asks for scheduled automation
and there is no way to deliver it without something, somewhere, polling a
queue.

**Revisit if:** Daily or Monthly automation is prioritized (generalize
`src/lib/queue/weekly-intelligence-queue.ts`'s single-purpose queue into
one queue per cadence, or one queue with a `cadence` field - decide once
there's a second real cadence to compare against, not speculatively now),
a client legitimately needs more than one weekly run's worth of
distinction from a manual trigger (revisit the "same `WorkflowRun` key,
so a manual analysis blocks the weekly idempotency window" choice above),
or the chosen worker host needs documenting concretely once a real
staging/production deployment happens (this entry documents the pattern,
not a specific Railway/Render/Fly.io account).

---

## 2026-09-11 — `trustHost: true` in Auth.js config, for non-Vercel deployment

**Decision:** `src/lib/auth/config.ts`'s `authConfig` sets `trustHost: true`
explicitly.

**Rationale:** Auth.js v5 only auto-trusts the incoming request's `Host`
header when it detects the `VERCEL` env var. On any other Node host - a
Hostinger Node.js app, Railway, a bare VPS - every single auth request
(including the unauthenticated `GET /api/auth/providers` the sign-in page
calls before any credentials are submitted) throws `UntrustedHost`
synchronously. That surfaces to the browser as a bare `500 Internal Server
Error` on `/api/auth/providers`, with sign-in appearing to silently "do
nothing" - found live while verifying a Hostinger deployment. This app has
no other logic that makes a security/authorization decision from the
`Host` header (tenant/client scoping is always resolved server-side from
the authenticated session per `docs/SECURITY.md` invariant 1, never from
request metadata), so trusting it here is safe.

**Alternative(s) considered:** Reading an `AUTH_TRUST_HOST` env var and
only trusting conditionally - rejected as needless indirection; the app
is already meant to be deployable outside Vercel for pilots
(`docs/PILOT-RUNBOOK.md`), so there's no deployment target where this
should be `false`.

**Revisit if:** A future deployment target needs strict host allowlisting
(e.g. multiple environments sharing one Auth.js secret where a spoofed
`Host` header could matter) - switch to Auth.js's array-of-trusted-hosts
form instead of the boolean.

---

## 2026-09-11 — `directUrl` added to the Prisma datasource, for pooled hosts (Supabase/Neon)

**Decision:** `prisma/schema.prisma`'s `datasource db` block adds
`directUrl = env("DIRECT_URL")` alongside the existing `url =
env("DATABASE_URL")`.

**Rationale:** Verifying a real deploy surfaced that `prisma migrate
deploy` needs a direct, unpooled connection - a transaction-mode pooler
(pgbouncer, which Supabase's default connection string uses) doesn't
support the advisory locks Migrate takes. Prisma's documented fix is
exactly this: `url` stays the pooled connection the running app uses for
ordinary queries, `directUrl` is a second connection string Migrate uses
instead. Only affects `prisma migrate`/`db push`; `PrismaClient` at
runtime (`src/lib/db/client.ts`) still only reads `url`, so this is
additive and doesn't change any existing runtime behavior. On a
non-pooled provider, `DIRECT_URL` is simply set to the same value as
`DATABASE_URL`.

**Alternative(s) considered:** Requiring every deployment target to use
an unpooled connection for `DATABASE_URL` too - rejected: it defeats the
point of a pooler for a serverless-style runtime (Vercel) making many
short-lived connections.

**Revisit if:** never, expected - this is Prisma's standard recommended
shape for any pooled Postgres provider.

---

## 2026-09-11 — Palette token values replaced with the approved brand palette; `rose`→`blush`, reserved `lavender`/`ai` token removed

**Decision:** Swapped every value in `globals.css`'s `:root` token block for
the approved palette (`#FAFAF8` page / `#FFFFFF` surface / `#E6E4E0`
border; `#201F1E`/`#6E6B68`/`#A3A09C` text scale; `#C1584F` primary,
`#A8453D` hover, `#F5E1DE` tint; `#93A889` sage, `#7C93A8` dusty-blue,
`#D4A94E` mustard, `#D9A0A0` blush). The token *names* and the whole
semantic layer (`success`/`warning`/`destructive`/`info`, `primary-*`,
`card`, `muted`, `caption`) are unchanged, so this is a value-only change
in two files (`globals.css`, `tailwind.config.ts`) with zero component
edits - the 2026-09-10 palette entry below already confirmed no hardcoded
colors exist outside the token system. Two structural changes alongside:
the error hue is renamed `rose`→`blush` to match the palette's own name
(`destructive` now resolves to `--blush-text`/`--blush-tint`), and the
`--lavender`/`ai` token reserved in the previous entry is removed - the
approved palette has no lavender, and a grep confirmed nothing in `src/`
ever consumed the `ai`/`bg-ai` classes.

**Rationale:** The palette was handed over as exact hex values, so the
correct scope is token-for-token substitution, not reinterpretation. The
derived darker "-text" stops were re-derived per hue rather than carried
over: blush's raw `#D9A0A0` is 1.9:1 on white, so `--blush-text` is a
40%-lightness reading of the same hue (7.2:1 on white, 6.3:1 on
`--blush-tint`); sage shifted hue 97→101 and its tint/text stops follow.
`--text-muted` (`#A3A09C`) is 2.6:1 on white - kept literal per the spec
because its only role is captions/timestamps/labels (as before), never
body copy; the comment on the token now says so explicitly.

**Alternative(s) considered:** Keeping lavender as a single off-palette
hue "for later" - rejected; an unused token that contradicts the approved
palette is exactly the kind of drift the 2026-09-10 entry was cleaning up.

**Revisit if:** an AI-generated-content marker is added to the product
(supersedes the previous entry's "Revisit if"): use `info`
(`--dusty-blue-*`) for it - the palette's neutral/informational hue - rather
than introducing a color outside the approved set.

---

## 2026-09-11 — UX/performance upgrade, Phase 2: per-request auth caching, ActionResult actions, loading states

**Decision:** Four conventions, applied to every existing page and action
(see `docs/UX-ASSESSMENT.md` for the audit that motivated them):

1. `getCurrentAuthContext` is wrapped in React `cache()` and resolves the
   default organization and the membership in one query
   (`resolveDefaultAuthContext`). Measured on the production build: the
   authorization chain went from 14 sequential statements per navigation
   (7-query chain × layout + page) to 6, once per request. `cache()` is
   per-request only - never shared across requests - so a user disabled
   mid-session is still denied on their next request (pinned by
   `tests/security/default-auth-context.test.ts`).
2. Every Server Action returns an `ActionResult` (`src/lib/actions/result.ts`)
   and never throws to the client; inputs are validated with Zod first.
   `ActionForm` / `SubmitButton` / `FieldError` (`src/components/ui/
   action-form.tsx`) drive `useActionState` + `useFormStatus`, so every
   mutation has a real pending state on the control that started it, an
   inline error, and a success toast - no `setTimeout`, no full-page reload.
   Known user-facing errors (Forbidden, IntegrationUnavailable, AiGateway,
   Zod, "already exists"-style lib validation) pass through with their own
   message; anything else is logged server-side and reduced to a generic
   message so internals never reach the browser.
3. `loading.tsx` skeletons for `/dashboard`, `/dashboard/clients`,
   `/dashboard/clients/[clientId]` and `/portal`, plus
   `experimental.staleTimes.dynamic = 30` so recently visited pages are
   instant on revisit (a Server Action's `revalidatePath` still invalidates
   them immediately).
4. List pages read `searchParams` for URL-backed filter tabs
   (`FilterTabs`), rejections collect a required reason (`RejectWithReason`)
   instead of writing a hardcoded string, and previously unbounded lists
   (`listApprovals`, `listIntegrationConnectionsForOrg`, per-client
   recommendation/report/calendar lists) take a `limit`. The content
   calendar defaults to an "upcoming" window (it used to return the oldest
   100 rows). `createClient` refuses a duplicate name within the
   organization (case-insensitive) - the three "LHO" cards were the
   previous silent `lho`/`lho-2`/`lho-3` slug suffixing.

Also: `vercel.json` pins functions to `hnd1` (Tokyo) to sit next to the
Supabase project's `ap-northeast-1` database - the measured per-query
round trip, not CPU, is what made navigation feel slow.

**Rationale:** The assessment measured the app as round-trip-bound
(local TTFB 20-66 ms, but 14 sequential auth queries per navigation on a
cross-region deployment). Fixing the count of sequential round trips and
painting a skeleton immediately are the two levers that change perceived
speed; nothing here adds artificial delay or client-side data fetching.

**Alternative(s) considered:** Prisma's `relationJoins` preview feature
would collapse the remaining 6 auth statements into one SQL join, but it
flips the default load strategy for *every* query in the app - deferred
until measured on the deployed topology after the region change; the
per-query `relationLoadStrategy: 'join'` is the next lever if needed.
Caching role permissions in memory across requests was rejected: it would
delay permission revocation and break the deleted-user guarantee.

**Revisit if:** the deployed p95 navigation is still above ~500 ms after
the region change (then enable `relationJoins` for the auth query), or a
second surface needs different `ActionResult` semantics.

---

## 2026-09-11 — UX/performance upgrade, Phase 3+4: Client entity extended, Client Workspace built

**Decision:** Extended `Client` with the profile fields the list/workspace
need directly (legalName, website, industry, country, city, timezone,
description, accountManagerId, monthlyBudget, tags, archivedAt), added
`ClientContact` (normalized, not columns - a client can have several),
and wired `accountManagerId` to `OrganizationUser` (a designated manager,
distinct from `ClientAssignment`'s "who may access this client"). One
migration (`client_profile_and_contacts`), generated via Prisma, not
hand-edited. Everything narrative (business/audience/brand/marketing)
stays in the existing `ClientBrain` JSON sections - unchanged, now
surfaced and editable in the UI for the first time.

New lib modules, each permission/tenant-checked like every other client
operation (`docs/SECURITY.md` invariant 1-2): `clients/profile.ts`
(update/archive/unarchive/delete - update and contacts need
`clients.edit`, archive/unarchive/delete need `clients.manage`, matching
BRD 4.1 vs 4.2), `clients/contacts.ts`, `clients/summary.ts` (the
Clients list's one-query data source: search/filter/sort computed in
SQL, filtered relation `_count`s for attention numbers rather than
fetching the rows to count them client-side). `createClient` now accepts
the full sectioned onboarding payload and writes it in one transaction -
profile, contacts, Brain sections, competitors, policy, an internal note
- so a partially-created client can never exist.

The Client Workspace (`clients/[clientId]/layout.tsx` + tab pages) splits
the old 550-line single page into Overview / Business / Brand / Audience
/ Marketing / Integrations / Settings, sharing one header. Business,
Brand, Audience and Marketing edit their Client Brain section directly -
this is the same data the AI Gateway reads on every analysis
(`clients/context-router.ts`), not a separate document that merely looks
similar (BRD "users need to understand what the AI knows about the
client"). `getAuthorizedClient` gained a React-`cache()`d variant
(`getAuthorizedClientCached`) for the layout + every tab page to share
one lookup per request, the same pattern already applied to auth context
in Phase 2; mutation call sites keep the uncached function.

Delete is a hard delete (cascades via the existing `onDelete: Cascade`
relations) requiring the user to type the client's exact name, both in
the UI (`ConfirmDialog`'s `requireText`) and re-enforced server-side
(`deleteClient` re-checks it - the UI guard is not the security
boundary). Archive is the soft-delete default the BRD asks to prefer:
sets `status: ARCHIVED` + `archivedAt`, keeps every row, hidden from the
list by the default `NOT_ARCHIVED` status filter. `createClient` also now
refuses a duplicate name per organization (case-insensitive) - upstream
of Phase 2's slug auto-suffix, which was the actual source of the
repeated "LHO" cards in the original screenshots; `prisma/seed.ts`'s two
sample clients gained real industry/website/location fields for the same
reason (BRD's "clean up seed data").

**Rationale:** BRD Section 9/10/12/13/17 in full - a rich Clients list,
a real onboarding flow, and a Client Workspace where Business/Brand/
Audience/Marketing *are* the Client Brain, editable per authorized role.

**Alternative(s) considered:** A JS stepper/wizard for onboarding -
rejected for a single form with collapsible `<details>`-style sections
(`components/clients/section.tsx`): every field stays mounted (so
switching sections never loses input), no extra client state to keep in
sync with the server action, and it degrades gracefully without
JavaScript. Putting Recommendations/Tasks/Approvals/Reports/AI Runs/
Creatives/Content Calendar on their own Workspace tabs was considered and
rejected: each already has a fully-featured org-wide page (Phase 2), so
Overview shows each trimmed to this client with a "View all" link,
avoiding duplicate filter/action implementations.

**Revisit if:** GA4/Search Console need a real connect flow (currently an
honest "coming soon" - no OAuth callback route exists yet); or Business/
Brand/Audience/Marketing sections outgrow free text enough to warrant
their own normalized tables instead of validated JSON.

---

## 2026-09-11 — UX/performance upgrade, Phase 5: Overview redesigned on the attention-scored client summary

**Decision:** `src/app/dashboard/page.tsx` now builds on
`listClientsWithSummary(ctx, { sort: 'attention' })` (Phase 3) instead of
its own ad hoc queries, so the Overview's "Attention required" section and
the Clients list's own attention badges are always the same numbers -
never two dashboards quietly disagreeing. Added: a per-client "Attention
required" list (top clients by `attentionScore`, each with direct
Review/Reconnect-style links into the specific thing needing action, not
just a count), an "Integration issues" summary tile, an "Upcoming work"
card (open tasks + scheduled content, both already bounded/sorted lib
functions from Phase 2), and an honest "Performance summary" empty state
naming exactly what's missing (no `AnalyticsSnapshot` read path exists
outside report generation yet) rather than a fabricated number.

**Rationale:** BRD Section 18/42 - "what needs attention across every
client right now," not a wall of tiles. Reusing the Phase 3 summary query
rather than writing a second, similar one for the dashboard was a
deliberate consistency choice - see docs/UX-ASSESSMENT.md §18.

**Alternative(s) considered:** A separate, dashboard-specific attention
query - rejected; the Clients list and Overview must agree, and only one
implementation can guarantee that.

**Revisit if:** `AnalyticsSnapshot` gets a general read path (currently
written only by the reporting pipeline) - wire the Performance summary
card to it then.

---

## 2026-09-11 — "Make it super fast": relationJoins + hot-path indexes

**Decision:** Two further, purely additive performance changes on top of
Phase 2-5, in response to a direct "make it super fast" request:

1. **`previewFeatures = ["relationJoins"]`** enabled on the Prisma
   generator, and `relationLoadStrategy: 'join'` applied to the three
   queries with several nested relations that run on every request -
   `resolveAuthContext`/`resolveDefaultAuthContext` (role → rolePermissions
   → permission, plus assignedClients) and `listClientsWithSummary`
   (accountManager.user, contacts, integrationConnections.integrationAccount
   .integration, aiRuns, three filtered `_count`s). Prisma's default
   strategy batches each relation as a separate query; `'join'` issues one
   SQL query with real JOINs instead. Deliberately not applied
   everywhere - most of this app's includes are one level deep (e.g.
   `client: { select: { name: true } }`), where Prisma's own batching is
   already a single extra query and a join adds nothing.
2. **New migration `hot_path_indexes_and_relation_joins`**: composite
   indexes on every client-owned table's actual filter shape from
   `scopedClientWhere` + the status/priority filters added in Phase 2 -
   `Approval`, `Recommendation`, `Task`, `IntegrationConnection`, `AiRun`,
   `Report`, `ContentCalendarItem`, `CreativeAsset`. None of these had any
   index before this beyond primary keys and one unique constraint - every
   list query on them was a sequential scan, fine at this session's seed
   data volume but the first thing to bite once client/row counts grow.

**Measured (production build, local Postgres, statement-logged)**:
queries per navigation - Overview 12 → 7, client workspace 18 → 11,
Approvals 7 → 2, Integrations 7 → 2. Combined with Phase 2's caching
(14 → 6 auth queries), Overview is now ~3x fewer statements than the
Phase-1 baseline (20). Every test in `tests/security/default-auth-context
.test.ts`, `tests/integration/client-profile.test.ts` (the query most
affected by the join) and the full suite still pass unchanged - the join
strategy changes execution, not results.

**Rationale:** Round trips, not CPU, were already established as the
app's actual bottleneck (docs/UX-ASSESSMENT.md §5) - this is that same
lever pushed further, plus the indexes are pure insurance against the
sequential-scan cliff every one of these tables was otherwise heading
toward as real data accumulates.

**Alternative(s) considered:** Making `relationLoadStrategy: 'join'` the
generator-wide default - rejected; per-query opt-in only changes the
handful of queries that actually nest multiple relations, and leaves
Prisma's already-efficient default behavior alone everywhere else.

**Revisit if:** Prisma promotes `relationJoins` out of preview (drop the
`previewFeatures` line, behavior is unaffected) - or a future query
gains enough nested relations to be worth the same treatment.

---

## 2026-09-13 — Role model simplified to Super Admin / Employee / Client, with email invitations replacing seed-only accounts

**Decision:** Collapsed the four seeded system roles (`super_admin`,
`account_manager`, `marketing_employee`, `client_user`) to three
(`super_admin`, `employee`, `client` - `src/lib/rbac/permissions.ts`).
`employee` is the union of the former `account_manager` +
`marketing_employee` permission sets (in practice, exactly
`account_manager`'s old list, since `marketing_employee` was already a
strict subset); nothing in this codebase enforced the two as separate
security boundaries - both were `SCOPED_CLIENT_ACCESS_ROLES`, accessing
clients identically via `ClientAssignment`. `client` is `client_user`
renamed, same semantics. A data migration
(`prisma/migrations/20260913060145_role_model_simplification_and_invitations`)
renames/merges existing `Role` rows and reassigns any `OrganizationUser`
memberships; it is safe to run even where an org never had a distinct
`account_manager` role.

The only way anyone gets access to the app is now an email invitation
(`src/lib/users/invitations.ts`, new `Invitation` model): a Super Admin
(the only role with `users.manage`) invites someone by email and picks
`employee` (optionally assigning clients) or `client` (tied to exactly
one client). Nothing is granted until the invitee follows the emailed
link and sets a password - no `OrganizationUser`/`ClientUser` row exists
before that, so a revoked or expired invite has granted literally
nothing. The raw token is never stored, only its SHA-256 hash. Email
delivery reuses `src/lib/email/mailer.ts` (extracted from
`src/lib/auth/config.ts`'s magic-link `sendVerificationRequest`, now
shared); when `EMAIL_SERVER_HOST` isn't configured, the invite still
exists and the raw link is handed back to the Super Admin in the Team
page UI (`/dashboard/team`) to send manually, rather than failing the
whole invite the way the magic-link flow does (which has no UI to fall
back to).

While integrating this with a separate branch of UI/feature work merged
from `origin` the same day (Meta Ads live integration, Gemini AI swap,
ads studio, content calendar rework), a `RoleSwitcher` component +
`switchRoleAction` server action were found and removed
(`src/components/role-switcher.tsx`, `src/app/actions/switch-role.ts`).
It re-signed the current browser in as one of three hardcoded seeded
accounts using their known dev password (`DevPassword!23`), one click,
for *any* already-authenticated user regardless of their real role - a
live privilege-escalation hole (a `client` in the portal could click
"Super Admin" and become one) once real accounts exist via the
invitation system above. There is no safe way to keep a "switch role"
shortcut once roles are backed by real, separately-authenticated
accounts; switching who you're signed in as now means signing out and
back in as that account, same as any real user.

**Rationale:** The four-role split added permission-set granularity
(`clients.edit`, `approvals.approve`, `ads.manage`) nobody had asked to
keep distinct once agency staff are just "employees" from the product's
point of view; simplifying to exactly the two roles a Super Admin hands
out removes a distinction that only ever existed in seed data and
comments, not in any enforced boundary. Deriving access exclusively from
email invitations (never a fabricated/self-granted role) is
docs/SECURITY.md's own invariant - "Claude/agents never decide their own
access" applies equally to "a user should never decide their own
access."

**Alternative(s) considered:** Keeping `account_manager` as a
super-admin-assignable "senior employee" tier with `clients.manage`-lite
privileges - rejected for now as unrequested scope; reintroduce as a
second invitable role later if a real narrower-than-`employee` tier is
needed. Eagerly creating `OrganizationUser`/`ClientUser` rows at invite
time (status `INVITED`, reusing the already-defined but unused
`MembershipStatus.INVITED`) instead of a new `Invitation` model -
rejected: `ClientUser` has no equivalent pending-state column, and a
single explicit `Invitation` row (email + role + target client(s) + token
+ expiry) is simpler to reason about and revoke than partially-created
membership rows.

**Revisit if:** A narrower staff tier (view-only, no ads/approvals) is
requested - add it as a new invitable role, not by re-splitting
`employee`. If the Super Admin role itself ever needs to be invitable
(a second Super Admin), extend `INVITABLE_ROLES` deliberately rather than
folding it into the general invite flow's assumptions (client-scoping
logic currently assumes every invitee is either org-wide-employee or
single-client).

---

## 2026-09-14 — Phase 3: agents propose real actions (`proposedActions` + `dispatchProposedActions`)

**Decision:** The Marketing Analytics Agent's structured output gains a
second array, `proposedActions` (`src/lib/agents/schemas.ts`'s
`ProposedActionSchema`), alongside the existing `recommendations`. Each
entry names a real provider (`META_ADS`/`GOOGLE_ADS`/`AMAZON_ADS`), an
action (`PAUSE_CAMPAIGN` | `UPDATE_BUDGET`), a `providerCampaignId` that
must be copied verbatim from the campaign data the agent was given, and a
`relatedRecommendationIndex` tying it back to the finding it carries out.
The agent's own tool allowlist is untouched - still every tool in it is
LOW risk (unit-tested), so the agent itself still only ever reads and
proposes, never executes (BRD Section 19 holds exactly as before).

A new file, `src/lib/automation/dispatch-proposed-actions.ts`, is the
deterministic (non-AI) orchestrator that decides what happens to each
proposal, wired into `analyze-client-workflow.ts` as a fifth step
(`execute_proposed_actions`, SKIPPED when there are no proposals - same
SKIP-vs-RUN pattern the persist/route steps already use). It is the first
code in this codebase to actually enforce `ClientPolicy.autoChangeAds`,
`maxBudgetChangePercent`, and `maxDailyAdBudget` as real checks rather
than decorative prompt context, and the first to make `Client.automationLevel`
change what a workflow run is allowed to do rather than only what it
displays. Gating, most to least permissive:

- `MANUAL` or `autoChangeAds` off -> every proposal is left untouched
  (`SKIPPED`) - identical behavior to before this phase existed.
- Campaign id not present in the exact data this run gathered -> `SKIPPED`
  outright, regardless of automation level - defense against a
  hallucinated or stale id, independent of whatever the structured-output
  schema already constrains.
- `UPDATE_BUDGET` exceeding `maxBudgetChangePercent` (vs. that campaign's
  own current budget) or `maxDailyAdBudget` (vs. the client's total known
  daily budget across every connected platform, with the change applied)
  -> forced into the same "draft only" path `ASSISTED` uses, whatever the
  automation level, with the violation recorded on the resulting
  Approval's `estimatedImpact`.
- `ASSISTED`, or any of the above policy violations: a pending Approval is
  created directly (bypassing the tool's own risk gate), so even a
  MEDIUM-risk pause never auto-executes - "AI drafts and prepares actions"
  means nothing runs until a human clicks Approve.
- `APPROVAL_BASED` / `HIGH_AUTOMATION`: dispatched through the ordinary
  `executeTool` risk gate, exactly like any other caller - MEDIUM
  (`pause_campaign`) executes immediately, HIGH (`update_budget`) still
  creates a pending Approval via the Tool Registry's existing mechanism.

Neither path ever passes an `agentKey` to `executeTool`/`createApproval` -
see the file's own doc comment. The Marketing Analytics Agent's allowlist
staying read-only is a real security boundary (BRD Section 31's per-agent
allowlist check), not incidental; the dispatcher acts on the resolved
ctx's own `ads.manage` permission, the same way the Ads Hub's manual
pause/resume button already does (`src/lib/ads/service.ts`'s
`toggleCampaignStatus`), not as if the agent itself were calling the tool.
Traceability to the run that produced the proposal still holds through
`workflowRunId` (carried on every execution/approval) and `aiRunId`
(carried in the approval's `proposedChanges` where relevant).

`prompts/analytics/v2.md` is a new prompt version (never edit `v1.md` in
place, per `src/lib/ai/prompts.ts`'s own doc comment) with instructions
for shaping `proposedActions`, while keeping every one of v1's rules
("recommendations are proposals for a human to review", "never invent
data") unchanged.

**Rationale:** This is Phase 3 of the automation roadmap published to the
user ("agents that propose real actions, not just findings"). The
alternative - letting Claude directly call `executeTool` from inside the
agent - was rejected outright as a direct violation of BRD Section 19
("No campaign modification should occur merely because Claude
recommends it") and Section 31 ("Claude/agents never decide their own
access"): an agent choosing to execute is exactly the failure mode this
whole architecture exists to prevent. Reusing the existing
`proposedChanges.toolKey` approval shape (the same one `execute.ts`'s own
risk gate already produces for any HIGH/CRITICAL tool call) rather than
inventing a new approval kind means every existing Approvals Gate UI page,
audit event shape, and `approveAndExecuteApproval` code path needed zero
changes to support this - a proposed-action approval looks, to every part
of the app except the dispatcher that created it, identical to any other
tool-call approval.

**Alternative(s) considered:** Extending the shared `AnalysisResultSchema`
(used by the Competitor and SEO agents too) with `proposedActions` -
rejected: neither of those agents produces anything executable, and
forcing an always-empty field onto their output just to share one type
is worse than the two-interface split (`AnalysisResult` /
`MarketingAnalysisResult extends AnalysisResult`) actually used. A zod
`discriminatedUnion` for `ProposedActionSchema` (action-keyed variants,
`newBudget` only present on the `UPDATE_BUDGET` variant) - rejected in
favor of a flat object with an optional `newBudget` plus a runtime guard
in the dispatcher: this codebase has no prior use of `discriminatedUnion`
with the AI Gateway's native structured outputs (`zodOutputFormat`), and
there is no live Anthropic credential in this environment to verify the
JSON Schema conversion behaves as expected for that shape - not worth the
risk on an unverified path when a flat schema + a defensive runtime check
achieves the same guarantee. Giving `APPROVAL_BASED` and `HIGH_AUTOMATION`
distinct dispatch behavior (rather than both simply deferring to
`executeTool`'s own risk gate) - deferred: the Tool Registry has no
mechanism today for a client policy to auto-approve a HIGH-risk call, so
there is nothing real to differentiate them on yet; inventing one here
would be speculative.

**Revisit if:** A MEDIUM-risk, budget-changing tool is ever added (none
exists today - `update_budget` is HIGH on every provider) - the
`maxBudgetChangePercent`/`maxDailyAdBudget` checks already forcing the
"draft only" path on a violation would then be the *only* thing stopping
an out-of-policy MEDIUM change from auto-executing under
`APPROVAL_BASED`/`HIGH_AUTOMATION`, so re-verify that path specifically.
If `APPROVAL_BASED` and `HIGH_AUTOMATION` need real behavioral daylight
between them, that belongs in the Tool Registry's risk-gate mechanism
(e.g. a client-policy-driven HIGH-risk auto-approval), not as a special
case bolted onto this file.

---

## 2026-09-14 — Phase 4: notifications (BRD Section 64/106)

**Decision:** `Notification` already existed in the schema (channel/type/
title/body/readAt) but nothing in the app ever wrote or read a row - this
phase wires it up end to end rather than replacing it. Added two columns
(`clientId String?`, `link String?`, one small migration) and built:

- `src/lib/notifications/recipients.ts` - who should hear about something
  on a given client: `resolveClientStaffRecipients` (ACTIVE assigned
  `ClientAssignment` staff + the client's account manager, deduped) and
  `resolveOrgAdminRecipients` (ACTIVE `super_admin`s - the escalation
  floor BRD Section 106 asks for, so a client with no staff assigned yet
  still isn't silently buried). Deliberately reuses the existing staffing
  model rather than a new subscription/preference system.
- `src/lib/notifications/service.ts` - `notifyRecipients` (writes an
  `IN_APP` row per recipient always, an `EMAIL` row + a real
  `sendMail` call only when the caller marks the notification worth an
  inbox interruption) and the read-side (`listNotificationsForUser`/
  `countUnreadNotifications`/`markNotificationRead`/
  `markAllNotificationsRead`) - every read/write scoped to `ctx.userId`,
  never a caller-supplied id; a notification's own row IS the
  authorization boundary, there is no separate permission for it.
  `notifyRecipients` never throws - every per-recipient DB or email
  failure is caught and logged, since a notification is a side effect of
  something that already happened, never the operation itself.
- Four trigger points, each wired into the one existing choke point every
  caller already goes through (not duplicated per call site):
  `createApproval` (approvals.ts) -> `APPROVAL_REQUIRED`, email for
  HIGH/CRITICAL only; `completeWorkflowRun` (workflows/runs.ts) on
  `FAILED` -> `WORKFLOW_FAILED`, always email; `recordIntegrationFailure`
  (integrations/health.ts) on the transition INTO `ERROR` (never on a
  repeat failure while already `ERROR` - fetches the prior status first)
  -> `INTEGRATION_CRITICAL_FAILURE`, always email; `persistRecommendations`
  (recommendations/persist.ts), one notification per run for every
  HIGH/CRITICAL finding together (not one per recommendation) ->
  `HIGH_PRIORITY_RECOMMENDATION`, email only if any is CRITICAL.
- UI: `NotificationBell` (header dropdown, `src/components/
  notification-bell.tsx`) and `/dashboard/notifications` (full history,
  All/Unread tabs). The bell is a Server Component - open/close is a
  hidden checkbox + `peer-checked:` + `<label htmlFor>`, the same no-JS
  disclosure pattern `layout.tsx`'s mobile nav drawer already uses (a
  `<label for>` natively toggles a checkbox off on an outside click; a
  plain `<details>` has no equivalent without a client-side handler, which
  would have forced the whole component to be a client component just for
  open/close). Only the "mark as read" buttons inside are interactive
  islands (`ActionForm`).

**Rationale:** BRD Section 64 lists exactly these six trigger categories
("Approval required, Critical integration failure, High-priority campaign
issue, Workflow failure, Scheduled report, Important client activity");
four are wired this phase (the four with an unambiguous single existing
choke point and a clear recipient set). "Scheduled report" and "Important
client activity" are deferred - see Revisit below, not silently dropped.
Choosing existing choke points (`createApproval`/`completeWorkflowRun`/
`recordIntegrationFailure`/`persistRecommendations`) over per-call-site
wiring means every current and future caller of each gets the
notification automatically - nobody creating an approval a new way, or
adding a fourth recommendation-producing workflow, can forget it, the same
reasoning already applied to why `executeTool` is the one place tool
authorization happens.

**Alternative(s) considered:** A real-time channel (SSE/WebSocket/polling)
for the bell - rejected for this phase: BRD Section 64 asks for "in-app"
support, not live push, and the layout already re-fetches
`countUnreadNotifications`/`listNotificationsForUser` on every navigation
(a Server Component), which is enough signal for an MVP inbox without a
new transport. A `<details>/<summary>` dropdown - rejected once outside-
click-to-close needed a `<label htmlFor>` a `<details>` has no equivalent
for (see above) - the checkbox/peer pattern was already established in
this exact file for the mobile nav drawer, so reusing it kept the bell a
Server Component instead of becoming a client component for no other
reason. A user-configurable notification-preferences system (which
channels/types a person wants) - out of scope for this phase; BRD Section
64 doesn't ask for one and the current channel/urgency choices per trigger
are reasonable, documented defaults, not something users lack any control
over that would be actively wrong.

**Revisit if:** "Scheduled report" (a report generated by an automated/
weekly run) and "Important client activity" (e.g. a client portal user
rejecting a recommendation, or leaving feedback) are wanted next - both
have clear existing choke points (`generateReport`, `rejectRecommendation`
when `ctx.isClientUser`) and would follow the exact same pattern as the
four here. If notification volume becomes a real problem, a per-user
preferences model (which types/channels to receive) is the natural next
layer on top of `resolveClientStaffRecipients`, not a replacement for it.
Slack/WhatsApp channels are already modeled in `NotificationChannel` but
have no delivery implementation - add them as new branches in
`notifyRecipients` when a real integration exists, never by reusing the
`EMAIL` branch's shape for something that isn't email.

---

## 2026-09-15 — Guided "Create Ad Campaign" wizard, replacing two fabricated flows

**Decision:** Replaced `/dashboard/ads/new` (a single dense form full of
jargon - "Target ACoS", "Manual Keyword Targeting (Exact/Phrase/Broad)",
"Sub-Placement") and the Ads Hub's "AI Ad Creator Studio" tab with one
guided, four-step wizard aimed at someone who has never run a digital ad
before: **What it's about → Where to run it → Budget & audience → Review
& create**. Each step asks a plain question, no acronyms, no assumed
platform knowledge.

While building this, found that **both flows it replaced were fabricating
data**, not just badly designed:

- The old form's `createCampaignAction` → `ads/service.ts`'s `createCampaign`
  wrote a `Campaign` row directly to the database with a fake
  `providerCampaignId` (`` `${provider}_${Date.now()}_${random}` ``) and a
  zero-metrics `CampaignMetric` row - it never called a real ad platform,
  despite real, write-capable Meta/Google/Amazon Ads adapters (Phases 1-2
  of the automation roadmap) already existing and going completely unused
  by this path. Defaulted `status` to `ACTIVE`, not `PAUSED` - contradicting
  every real adapter's own invariant and BRD Section 21.
- The Ads Hub's "AI Ad Creator Studio" tab (`AIAdCreatorStudio`) was pure
  UI theater: `setTimeout(900)` in place of an AI call, a hardcoded
  template string in place of AI-generated ad copy, and a "Publish"
  button that only ever set local React state - never called a server
  action, never touched the database, never called `executeTool`. It
  displayed "Campaign Successfully Staged & Queued! ... submitted to the
  Approvals Gate" when nothing had been submitted anywhere. Both are
  direct violations of this file's own rule 5 ("Never fabricate external
  data... Do not invent metrics or provider data") - removed outright
  rather than kept alongside a real replacement.

The new wizard is real end to end:

- `src/lib/ads/campaign-brief.ts` - a new, empty-tool-allowlist
  "Campaign Brief Agent" (same shape as the Creative/Competitor agents)
  turns the wizard's plain-language answers + Client Brain context
  (`prompts/campaign-brief/v1.md`, a new prompt category added to the
  Context Router: `business`/`audience`/`brand`/`marketing`) into a
  structured brief - campaign name, jargon-free strategy note, audience
  summary, an honest budget assessment (explicitly forbidden from
  promising a specific numeric outcome - no data exists to base one on),
  and one draft ad concept. Still just a proposal (BRD Section 19) - this
  agent cannot execute anything.
- `src/lib/ads/launch.ts`'s `launchCampaignFromWizard` is the real,
  separate execution step, only reached after a human reviews (and can
  edit) the brief. Calls the actual `{provider}.create_campaign` tool
  through `executeTool` - the same MEDIUM-risk, always-PAUSED path every
  other caller of that tool already goes through - then upserts the local
  `Campaign` row from the tool's genuine response (the exact pattern
  `src/lib/integrations/meta-ads/sync.ts` already uses for campaigns a
  sync discovers), and persists the reviewed ad copy as a `DRAFT`
  `CreativeAsset` linked via the (already-existing, previously
  never-populated) `campaignId` column.
- `src/lib/ads/connected-providers.ts` - the wizard's platform step only
  ever offers platforms actually connected (`CONNECTED`/`DEGRADED` health)
  for the chosen client, one batched query for every accessible client so
  changing the client selector mid-wizard needs no extra round trip; an
  unconnected platform is shown, grayed out, with a direct link to connect
  it rather than hidden outright. Also surfaces `ClientPolicy.
  maxDailyAdBudget` as a plain-language warning (never a hard block - a
  human is reviewing every launch here) when the entered daily budget
  exceeds it.
- Budget is asked and stored consistently as a **daily** amount across all
  three platforms, matching what `budget` actually means to every real
  adapter (Meta's `dailyBudget`, Amazon's explicit `dailyBudget`, Google's
  standard-delivery `CampaignBudget.amount_micros`) - the old form asked
  for a "Monthly Ad Spend Budget" and silently handed that number to a
  field every platform treats as daily.

**Rationale:** The user's explicit ask was a genuinely significant UX
change - a step-by-step, AI-integrated flow for someone with zero
marketing background, "like scheduling a post." That's incompatible with
either prior flow: one was expert-only by design, the other was a
convincing-looking demo with nothing real behind it. Building the real
version on top of the already-real Tool Registry/Approval Engine/Creative
Asset lifecycle (all built in earlier phases) rather than inventing new
plumbing meant the actual new surface area is small - one new AI call
shape, one new execution function, one new UI flow - everything else
(risk gating, audit, the pause/resume toggle, the Approvals Gate) already
existed and needed zero changes to work correctly with a wizard-launched
campaign.

**Alternative(s) considered:** Keeping the detailed form alongside the
wizard for power users - considered and explicitly rejected by the user in
favor of a clean replacement, given the detailed form's own execution path
was fake. Reusing the Creative Agent's `runCreativeConceptGeneration` for
the wizard's draft ad instead of generating it inside the same call as the
campaign strategy - rejected: a second AI Gateway round trip would slow
down what should feel like an instant "next, next" wizard step, and the
two outputs (campaign name/strategy/budget assessment vs. an ad concept)
are naturally grounded by the same context in one call. Enforcing
`ClientPolicy.requireApprovalForCampaignLaunch` in this wizard - not
needed: that field is about **launching** (activating) a campaign, which
this wizard never does - it only ever creates a paused draft, and
activating one already goes through `toggleCampaignStatus`'s existing
HIGH-risk `update_campaign` approval gate (BRD Section 21: "launch
campaign" is HIGH risk regardless of how the paused draft was created).
Applying Phase 3's `Client.automationLevel`/`ClientPolicy.autoChangeAds`
gating to this flow - rejected: that gate exists for the AI analysis
agent's own autonomous proposals, a different trust boundary from a staff
member explicitly using a guided tool with full review at every step,
exactly as the un-gated old form worked.

**Revisit if:** A `create_ad_group`/`create_ad`-level write tool is ever
added per provider - today only campaign-level `create_campaign` (name +
budget) is real, so the wizard cannot set real keyword/audience targeting
on the platform itself; it captures the audience description as AI
context only, never as a platform-level targeting parameter. Client Brain
prefill (auto-filling "what's this about" from `ClientBrain.business.
productsServices`) was scoped out of this pass to keep it contained - a
reasonable next addition, not a gap being ignored.

---

## 2026-09-15 — Dashboard "ask anything" search bar + wizard help polish

**Decision:** Added a genuine natural-language Q&A search bar to the main
dashboard ("ask anything about your marketing") and a two-tier help system
inside the guided ad campaign wizard - static `HelpHint` tooltips for fixed
field explanations, plus a persistent "not sure? ask" AI helper for
open-ended questions - along with visual step icons and CSS-only
animations for step transitions and answer reveals. Both AI surfaces are
backed by one shared module, `src/lib/search/marketing-search.ts`, a
single read-only agent (`marketing_search`, empty tool allowlist, same
pattern as the Creative/Competitor/Campaign Brief agents) with two entry
points: `answerMarketingQuestion` (dashboard bar - grounds on a matched
client's full context, if the question names one, plus pending approvals
and HIGH/CRITICAL recommendations across every client the caller can
access) and `answerWizardQuestion` (wizard helper - grounds only on the
one client's context and where they are in the wizard, deliberately never
the wider org snapshot, since a "what does this field mean" question has
no use for other clients' data).

**Rationale:** One module instead of two nearly-identical ones keeps the
prompt/AiRun-tracking machinery, the self-registration pattern, and (most
importantly) the tenant-scoping discipline in exactly one place - every
data source `answerMarketingQuestion` pulls from (`listAccessibleClients`,
`listApprovals`, `listRecommendationsForOrg`, `assembleClientContext`) is
already independently tenant/permission-scoped, so this module adds no new
scoping logic of its own. This is deliberately a different surface from
the header's existing `UniversalSearch` (instant client-name/page
typeahead, no AI call) - that one jumps you somewhere; this one answers a
question. Plain CSS `@keyframes` (`globals.css`) instead of an animation
library - none was already a dependency, and the transitions needed
(fade/slide on step change, shimmer while loading) don't warrant adding
one. Static `HelpHint` text instead of always calling AI for "what is
this field" - faster, free, and still available if the AI Gateway is
down; the AI helper is reserved for questions a fixed tooltip can't
answer ("which platform for a local bakery?").

**Alternative(s) considered:** Reusing `searchAccessibleClients`
(`src/lib/clients/search.ts`) to find a client named in the dashboard
question - rejected after it turned out backwards: that function is built
for the header's prefix typeahead (`name CONTAINS query`), so it only
matches when the *entire* free-text question is a substring of a client's
name, which real questions never are. Built `listAccessibleClients` +
`findNamedClient` instead - the correct direction (`query CONTAINS
client.name`), picking the longest matching name to avoid a short name
accidentally matching inside an unrelated one. A single combined
dashboard-search-and-wizard-help component - rejected: the two live in
different parts of the tree with different grounding data and different
persistence needs (the wizard helper must survive across wizard steps
without resetting), so two small client components sharing one backend
module was simpler than one component branching on where it's rendered.

**Revisit if:** The dashboard search bar's example-question chips or the
wizard's static `HelpHint` copy need to vary per client vertical (e.g.
different phrasing for e-commerce vs. local-service clients) - today both
are fixed, agency-wide text.

---

## 2026-09-15 — Marketing search bar: grounded in real ad campaign performance

**Decision:** Reported bug: asking the dashboard search bar "Meta ads of
[client], how they are performing?" answered "I don't have performance
data" even though the client has real, synced campaigns with spend/clicks/
ROAS visible on the Ads Hub. Root cause: `answerMarketingQuestion`
(`src/lib/search/marketing-search.ts`) never queried campaign data at all
- it only ever grounded on client brain context, approvals, and
recommendations. Fixed by pulling `listCampaigns` (`src/lib/ads/
service.ts`, already tenant-scoped, the same source the Ads Hub table
reads) into the prompt: when the question names a specific client, every
one of that client's campaigns with full metrics (spend, impressions,
clicks, CTR, CPC, conversions, revenue, ROAS); otherwise a per-client
spend/ROAS rollup across every accessible client, so a broader "how's our
overall ad spend" question still gets real numbers without dumping every
campaign row into the prompt.

**Rationale:** `listCampaigns` was the obvious, already-scoped source -
reusing it keeps the "every data source is independently tenant-scoped"
invariant intact rather than writing a new query. The client-vs-rollup
split mirrors the existing client-context behavior (full detail when
named, a bounded summary otherwise) for the same prompt-size reason.

**Alternative(s) considered:** Always fetching every accessible client's
full campaign list regardless of whether one was named - rejected as
unbounded prompt growth for an agency with many clients; the rollup gives
the same "how are we doing overall" answer with O(clients) not
O(campaigns) size.

**Revisit if:** The per-client campaign list itself grows large enough
that even one client's full metrics blow up the prompt - would need a
cap (e.g. top N campaigns by spend) the same way the rollup already caps
at 10 clients.

---

## 2026-09-15 — Marketing search bar: structured analysis, not just data recital

**Decision:** Follow-up feedback on the campaign-performance fix above:
once real numbers were flowing into the prompt, the search bar's answer
to "analyse my LHO Beacon Meta ads" was still just a plain-language
recital of the numbers back at the user - no interpretation, no "what to
do next". Added three structured array fields to `MarketingSearchAnswerSchema`
(`workingWell`, `needsAttention`, `nextSteps`) alongside the existing
`answer`/`notCovered`, each item required to cite the actual numbers it's
based on. Rewrote `prompts/marketing-search/v1.md` to instruct the model
to *compare* the given campaigns' CTR/CPC/ROAS against each other, flag
what's converting well vs. what's spending without results, and give
concrete next steps traceable to a specific flagged number - while
keeping every existing discipline (never invent a number, never promise a
future outcome). The dashboard search bar (`marketing-search-bar.tsx`)
renders the three arrays as labeled bullet sections under the headline
answer, each empty and hidden when the question wasn't an analysis one.

**Rationale:** Comparing numbers that are already in the prompt (this
campaign's 0.36% CTR vs. that one's 2.59%) is analysis, not fabrication -
every fact in the comparison came from real synced data, so this doesn't
weaken the "never fabricate" invariant, it exercises the same numbers
more usefully. Splitting into three schema fields (vs. one long free-text
paragraph) does two things: it makes "did the model actually analyze, or
just recite" checkable by tests (empty arrays vs. non-empty), and it lets
the UI render a scannable report instead of a wall of text.

**Alternative(s) considered:** A single `analysis: string` free-text
field instead of three arrays - rejected: nothing stops a model from
writing one unstructured paragraph that's still just a recital; separate,
explicitly-described fields make "cite the numbers behind each item" a
per-item instruction the model has to satisfy three times over, not once
for a whole paragraph. Always requiring non-empty analysis arrays -
rejected: a quick lookup question ("what needs my approval") has nothing
to analyze, and forcing analysis there would mean either padding with
filler or violating the "never invent" rule to fill the field.

**Revisit if:** Users want analysis grounded in external benchmarks
(industry-average CTR/CPC for a vertical) rather than only relative
comparison across the client's own campaigns - today there is no such
benchmark data source, so the prompt is deliberately scoped to what can
be compared within the real data given, never an invented "average CTR
for bakeries is X%".

---

## 2026-09-15 — Meta App Review rejection: fixed the code causing the high Ads API error rate

**Decision:** Meta rejected this app's Marketing API Access Tier submission
for two reasons: insufficient Ads API call volume in the last 15 days, and
too high an error rate in the last 500 calls. Investigated the second one
as a real code bug rather than an operational fluke, and found one:
`syncMetaAdAccountTelemetry` (`src/lib/integrations/meta-ads/sync.ts`)
requested a *daily* insights breakdown (`time_increment=1`, hardcoded)
spanning the account's *entire* history (`date_preset=maximum`) as its
first attempt on every sync, catching the failure and retrying with
`last_90d`. Meta's Insights API rejects a daily breakdown spanning more
than ~90 days outright - so once a connected account has any real history,
that first attempt is **not occasionally** a failure, it's **always** one,
on every scheduled sync (daily cron, every connection) and every new
connection (`connect.ts` runs an immediate first sync on connect). Fixed
by requesting the valid window directly, dropping the doomed first
attempt entirely. Also fixed three related issues found in the same pass:
the per-campaign insights fallback was spending calls on ARCHIVED/DELETED
campaigns that can never have fresh data; `metaFetch` had no retry for
Meta's own transient/rate-limit error codes (so a momentary throttle
became a permanent failure); and the Graph API version was hardcoded to
v20.0, past Meta's typical ~2-year support window as of this date - now
`META_GRAPH_API_VERSION` (env-configurable, defaults to a current
version).

**Rationale:** A guaranteed-to-fail call baked into the hot path of both
the daily cron and every new connection is exactly the kind of systematic,
high-volume error source Meta's own review tooling would flag - far more
plausible as the primary cause than intermittent network blips, and it's
concretely reproducible/provable (a unit test - `tests/integration/
meta-ads-sync-error-rate.test.ts` - pins that the first insights call is
now always the valid window, never the doomed one). The retry-with-backoff
addition is a genuine best practice regardless of whether it was the
literal rejection cause: any production Meta Marketing API integration
will occasionally hit the platform's own rate limits, and eating those as
permanent failures instead of a short retry directly inflates the app's
measured error rate for no benefit.

**Alternative(s) considered:** Retrying every failed Meta API call,
including genuine 4xx errors (bad parameters, invalid token, permission
denied) - rejected: retrying a call that can never succeed only spends
more of the same limited "last 500 calls" error-rate budget on the exact
same failure, it doesn't reduce the rate. Only the documented
transient/throttle error codes (1, 2, 4, 17, 32, 613) and 5xx statuses are
retried.

**Revisit if:** Meta's own App Review feedback flags a *different* error
pattern after re-submission - this fix addresses the one concrete,
reproducible bug found in this pass, not a guarantee against every
possible source of API errors. The "insufficient call volume" rejection
reason still needs genuine sustained usage (a real connected ad account,
active for 15+ days) before re-submitting - no code change satisfies that
one; see docs/INTEGRATIONS.md's 2026-09-15 entry for the operational
checklist.

---

## 2026-09-15 — meta-ads-sync cron's maxDuration silently broke it on Vercel Hobby

**Decision:** After connecting a real Meta ad account (see the App Review
fix above), the daily sync still wasn't running - traced to
`src/app/api/cron/meta-ads-sync/route.ts`'s `export const maxDuration =
300`. Vercel's Hobby plan caps function duration at 60s and *rejects the
deployment* when a route declares more than the plan allows - the same
"Hobby rejects outright, it doesn't downgrade" behavior already documented
for cron schedule frequency (2026-09-13), just for duration instead of
cadence, and not caught until now because nothing in this environment
exercises an actual Hobby-plan deploy. Fixed by pinning `maxDuration` to
60 and adding a wall-clock time budget (`TIME_BUDGET_MS = 45_000`) inside
the sync loop: once several connections are due in the same run, the loop
stops well before the hard cap and reports the rest as `deferred` in the
response rather than letting Vercel kill the function mid-request.
`findMetaAdsConnectionsDueForSync` already orders stalest-first, so a
deferred connection gets priority on tomorrow's run - nothing is ever
permanently skipped, just delayed by at most a day if there's ever a
backlog.

**Rationale:** A time-budget cutoff is more robust than a fixed
connections-per-run cap: each connection's real cost varies with how many
campaigns it has (including the 4b fallback's per-campaign insights
calls), so a count-based limit would either be too conservative most days
or still risk the timeout on a client with unusually many campaigns. Tying
the cutoff to actual elapsed time is what the underlying constraint
(Vercel's wall-clock cap) actually is.

**Alternative(s) considered:** Moving this cron to the same enqueue-to-
BullMQ pattern as the weekly intelligence job (a separate always-on worker
process) - rejected for the same reason the file's own doc comment already
gives: no LLM cost and no expensive/long-running Claude call per
connection, so the inline-in-one-invocation shape is still right; the
actual problem was the declared duration exceeding the plan, not the
architecture. Upgrading to Vercel Pro to just raise the cap back to 300 -
left as the user's call, not assumed here; the fix works correctly on
Hobby as-is and the constants are called out in the file's own comment for
whoever upgrades later.

**Revisit if:** The agency's client count grows enough that 45s regularly
isn't enough to sync every due connection in one run (i.e. `deferred` is
consistently non-zero in the cron's response) - at that point either
upgrade to a paid plan (raise `maxDuration`/`TIME_BUDGET_MS` back up) or
split the due connections across multiple scheduled invocations.

---

## Template for future entries

```text
## YYYY-MM-DD — <short title>

**Decision:** ...
**Rationale:** ...
**Alternative(s) considered:** ...
**Revisit if:** ...
```
