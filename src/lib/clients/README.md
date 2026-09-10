# clients

Client Brain CRUD and the Context Router (BRD Section 6-7).

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

No agent calls this yet — Day 9's Analytics Agent is the first real consumer.
