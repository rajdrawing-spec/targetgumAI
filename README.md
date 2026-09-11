# TargetGum AI Marketing OS

Multi-tenant AI-powered operating system for a digital marketing agency. Claude
reasons, TargetGum controls authorization, MCP/APIs execute, workflows automate,
humans approve exceptions, and everything is audited.

**Status:** The 15-day MVP build is complete, and BRD Section 85's entire Phase 2
backlog is now also complete and tested — social content calendar, SEO workflows,
advanced reporting, a Competitor Agent, automated social scheduling, native Google
Ads/Meta Ads, a Canva creative workflow, and weekly scheduled automation
(Redis/BullMQ). Every module runs end-to-end against mock providers; nothing has
been exercised against real Claude, Metricool, GA4, GSC, Canva, or Ads credentials
from a deployed instance of the app itself — see
[`docs/EXTERNAL-APPROVALS.md`](docs/EXTERNAL-APPROVALS.md) for exactly what's
missing and [`docs/PILOT-RUNBOOK.md`](docs/PILOT-RUNBOOK.md) for how to run a real
pilot once those credentials exist. See
[`docs/MVP-CHECKLIST.md`](docs/MVP-CHECKLIST.md) for the full day-by-day record and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture assessment.

## Start here

- [`CLAUDE.md`](CLAUDE.md) — rules for anyone (human or AI) working in this repo
- [`docs/BRD-PRD.md`](docs/BRD-PRD.md) — the source-of-truth product spec
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — proposed stack, structure, plan
- [`docs/MVP-CHECKLIST.md`](docs/MVP-CHECKLIST.md) — what's built vs. pending
- [`docs/PILOT-RUNBOOK.md`](docs/PILOT-RUNBOOK.md) — how to run a real client pilot
  once live credentials exist

## Local development

Requires Node.js ≥ 20, PostgreSQL 16, and Redis. Redis is only needed if you want
to exercise weekly scheduled automation (`npm run worker`, `/api/cron/
weekly-intelligence`) — every other feature runs without it.

### 1. Get Postgres + Redis running

The fastest way, if you have Docker:

```bash
docker run -d --name targetgum-postgres -e POSTGRES_USER=targetgum \
  -e POSTGRES_PASSWORD=targetgum_dev_password -e POSTGRES_DB=targetgum_dev \
  -p 5432:5432 postgres:16

docker run -d --name targetgum-redis -p 6379:6379 redis:7
```

Without Docker: install PostgreSQL 16 and Redis via your OS package manager
(`brew install postgresql@16 redis` on macOS, `apt install postgresql-16
redis-server` on Debian/Ubuntu) and start both services.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` — never commit it. At minimum:

- `DATABASE_URL` — point at the Postgres instance above, e.g.
  `postgresql://targetgum:targetgum_dev_password@localhost:5432/targetgum_dev`
- `AUTH_SECRET` / `INTEGRATION_ENCRYPTION_KEY` — any local placeholder value works
  for dev (`openssl rand -base64 32` for something realistic)
- `REDIS_URL` — `redis://localhost:6379`, only needed for the weekly-automation
  worker/cron route
- `CRON_SECRET` — any value, only needed to call `/api/cron/weekly-intelligence`
  yourself

Everything else in `.env.example` (Anthropic, Metricool, GA4, GSC, Canva, Google
Ads, Meta Ads) can stay blank — every one of those integrations has a full mock
implementation and the app runs completely normally without them, clearly labeling
mock data as mock in its own console warnings (`[metricool] METRICOOL_MCP_URL not
configured - using MetricoolMockProvider.`, etc.).

**To see real AI output** (recommendations, creative concepts, reports written by
Claude instead of the "no data source connected" zero-spend path), set
`ANTHROPIC_API_KEY` to a real key — this is the one credential that meaningfully
changes what you see locally without touching any other provider.

### 3. Install, migrate, seed, run

```bash
npm install
npm run prisma:migrate       # applies every migration to your local DATABASE_URL
npm run db:seed              # sample org, roles, 2 clients, 3 dev-login users
npm run dev
```

Then sign in at `/sign-in` with one of the seeded dev users (password
`DevPassword!23` for all): `super-admin@targetgum.dev` (sees every client),
`employee@targetgum.dev` (sees only the one client they're assigned to),
`client-a-user@targetgum.dev` (client-portal access to that one client only).
These exist only via `prisma/seed.ts` — there's no sign-up flow yet.

### 4. (Optional) Run the weekly-automation worker

Only needed to see scheduled automation actually process a job end-to-end (it
otherwise sits queued): in a second terminal, with `REDIS_URL` set,

```bash
npm run worker
```

Toggle "Weekly automated intelligence" on for a client (its detail page → Policy
card), then either wait for `vercel.json`'s schedule or trigger it yourself:

```bash
curl http://localhost:3000/api/cron/weekly-intelligence \
  -H "Authorization: Bearer $CRON_SECRET"
```

The worker process picks up the enqueued job, runs the same analysis "Analyze this
client" does, and the result shows up on the client's Reports/Recommendations
cards like any other run.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run worker` | Start the BullMQ weekly-automation worker (needs `REDIS_URL`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | All Vitest suites (unit/integration/security) |
| `npm run test:e2e` | Playwright end-to-end (once specs exist) |
| `npm run build` | Production build |
| `npm run prisma:migrate` | Create/apply a local migration |
| `npm run db:seed` | Seed sample org/clients/users |

## Documentation index

See [`docs/`](docs/) for the full set: `ARCHITECTURE.md`, `DATA-MODEL.md`,
`SECURITY.md`, `INTEGRATIONS.md`, `AGENTS.md`, `WORKFLOWS.md`, `APPROVALS.md`,
`DECISIONS.md`, `MVP-CHECKLIST.md`, `EXTERNAL-APPROVALS.md`, `PILOT-RUNBOOK.md`.
