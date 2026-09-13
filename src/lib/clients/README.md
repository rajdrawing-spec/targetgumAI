# clients

Client Brain CRUD, the Context Router (BRD Section 6-7), client creation, and
cross-client listing.

- `create.ts` (Day 15) — `createClient(ctx, {name, slug?})`: the code path missing
  through Day 14 - up to that point every `Client` row came from `prisma/seed.ts` or
  test factories. Gated by `clients.manage` (Super Admin - BRD Section 4.1's
  unscoped "Manage clients"). Auto-slugifies the name, suffixing on collision;
  always creates a default `ClientPolicy` row alongside, same as `createTestClient`.
- `list.ts` (Day 13) — `listAccessibleClients(ctx)`: org-wide, scoped to the caller's
  authorized set - the dashboard's Clients list/Overview count, and the Client
  Portal's client picker (`src/app/portal/`).
- `brain-schemas.ts` — Zod schemas for the four narrative ClientBrain sections
  (business/audience/brand/marketing). Every write is validated against these —
  never store unvalidated JSON.
- `brain.ts` — CRUD, all tenant- and permission-checked the same way as everything
  else: `clients.read` for reads; `clients.edit` (Phase 2 - narrower than
  `clients.manage` above, which is creation-only; `.edit` is updating an
  *already-accessible* client's Brain/brand assets/competitors/policy, granted to
  `employee` too, still confined to their assigned clients by
  `assertClientAccess` - see docs/DECISIONS.md) for `updateClientBrainSection`,
  `addClientBrandAsset`, `addClientCompetitor`, `updateClientPolicy`; `feedback.create`
  (Phase 2 - also granted to `client`, BRD Section 4.4 "Provide feedback") for
  `addClientFeedback` specifically.
- `context-router.ts` — `assembleClientContext(ctx, clientId, category)`: the
  Context Router. Returns only the Client Brain slice relevant to `'analytics' |
  'content' | 'reporting'`, never the whole brain — see the category→sections map in
  the file. `renderContextAsText` turns that into a plain-text block for the AI
  Gateway's `userMessage` (`src/lib/ai/gateway.ts`).

Day 9's Analytics Agent is the first consumer of the Context Router; the Day 13/14/15
dashboard (`src/app/dashboard/`) and the Phase 2 Client Portal (`src/app/portal/`)
are the consumers of everything else here.
