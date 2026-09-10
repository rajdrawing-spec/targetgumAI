# clients

Client Brain CRUD, the Context Router (BRD Section 6-7), client creation, and
cross-client listing.

- `create.ts` (Day 15) — `createClient(ctx, {name, slug?})`: the code path missing
  through Day 14 - up to that point every `Client` row came from `prisma/seed.ts` or
  test factories. Gated by `clients.manage` (Super Admin - BRD Section 4.1 "Manage
  clients"). Auto-slugifies the name, suffixing on collision; always creates a
  default `ClientPolicy` row alongside, same as `createTestClient`.
- `list.ts` (Day 13) — `listAccessibleClients(ctx)`: org-wide, scoped to the caller's
  authorized set - the dashboard's Clients list/Overview count.
- `brain-schemas.ts` — Zod schemas for the four narrative ClientBrain sections
  (business/audience/brand/marketing). Every write is validated against these —
  never store unvalidated JSON.
- `brain.ts` — CRUD, all tenant- and permission-checked (`clients.read`/
  `clients.manage`) the same way as everything else: `getClientBrainSection(s)`,
  `updateClientBrainSection`, brand assets, competitors, policy, feedback.
- `context-router.ts` — `assembleClientContext(ctx, clientId, category)`: the
  Context Router. Returns only the Client Brain slice relevant to `'analytics' |
  'content' | 'reporting'`, never the whole brain — see the category→sections map in
  the file. `renderContextAsText` turns that into a plain-text block for the AI
  Gateway's `userMessage` (`src/lib/ai/gateway.ts`).

Day 9's Analytics Agent is the first consumer of the Context Router; the Day 13/14/15
dashboard (`src/app/dashboard/`) is the consumer of everything else here.
