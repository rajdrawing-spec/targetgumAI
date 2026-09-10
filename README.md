# TargetGum AI Marketing OS

Multi-tenant AI-powered operating system for a digital marketing agency. Claude
reasons, TargetGum controls authorization, MCP/APIs execute, workflows automate,
humans approve exceptions, and everything is audited.

**Status:** Foundation, database schema, and authentication/RBAC/tenant isolation
are built (Week 1, Days 1-3 of the build plan) — see
[`docs/MVP-CHECKLIST.md`](docs/MVP-CHECKLIST.md) for live progress and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture assessment.

## Start here

- [`CLAUDE.md`](CLAUDE.md) — rules for anyone (human or AI) working in this repo
- [`docs/BRD-PRD.md`](docs/BRD-PRD.md) — the source-of-truth product spec
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — proposed stack, structure, plan
- [`docs/MVP-CHECKLIST.md`](docs/MVP-CHECKLIST.md) — what's built vs. pending

## Local development

Requires Node.js ≥ 20, PostgreSQL 16, and Redis (for later steps).

```bash
cp .env.example .env.local   # fill in real values, never commit this file
npm install
npm run prisma:migrate       # applies migrations to your local DATABASE_URL
npm run db:seed              # sample org, roles, 2 clients, 3 dev-login users
npm run dev
```

Then sign in at `/sign-in` with one of the seeded dev users (password
`DevPassword!23` for all): `super-admin@targetgum.dev` (sees every client),
`employee@targetgum.dev` (sees only the one client they're assigned to),
`client-a-user@targetgum.dev` (client-portal access to that one client only).
These exist only via `prisma/seed.ts` — there's no sign-up flow yet.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | All Vitest suites (unit/integration/security) |
| `npm run test:e2e` | Playwright end-to-end (once specs exist) |
| `npm run build` | Production build |
| `npm run prisma:migrate` | Create/apply a local migration |

## Documentation index

See [`docs/`](docs/) for the full set: `ARCHITECTURE.md`, `DATA-MODEL.md`,
`SECURITY.md`, `INTEGRATIONS.md`, `AGENTS.md`, `WORKFLOWS.md`, `APPROVALS.md`,
`DECISIONS.md`, `MVP-CHECKLIST.md`, `EXTERNAL-APPROVALS.md`.
