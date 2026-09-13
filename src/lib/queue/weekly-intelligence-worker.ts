import { Worker, type Job } from 'bullmq'
import { db } from '@/lib/db/client'
import { DEFAULT_ADS_CHANNEL, DEFAULT_SOCIAL_NETWORK } from '@/lib/workflows/defaults'
import { runAnalyzeClientWorkflow } from '@/lib/workflows/analyze-client-workflow'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRedisConnection } from './connection'
import { resolveAutomationActor } from './resolve-actor'
import { WEEKLY_INTELLIGENCE_QUEUE_NAME, type WeeklyIntelligenceJobData } from './weekly-intelligence-queue'

const RANGE_DAYS = 7

/**
 * The weekly automation processor. Exported standalone (not only wired
 * into a `Worker`) so it's directly callable in tests without running a
 * real polling BullMQ `Worker` loop - same "processor logic factored out
 * for testability" shape as `src/lib/tools/execute.ts`'s
 * `authorizeCall`/`runAuthorizedTool` split.
 *
 * Reuses `runAnalyzeClientWorkflow` unchanged - a scheduled run is not a
 * different workflow, just a different trigger source (BRD Section 65:
 * "Weekly - marketing performance summary, recommendations"). Every
 * `AiRun`/`WorkflowRun`/`Recommendation`/audit row it produces is
 * therefore indistinguishable in shape from a human clicking "Analyze
 * this client" - deliberately, so nothing downstream (the dashboard, the
 * approval flow, reporting) needs to special-case "was this automated."
 *
 * If no eligible staff is assigned to the client (`resolveAutomationActor`
 * returns null), this records a DENIED audit event and returns without
 * throwing - a missing assignment is an expected, recoverable state (staff
 * turnover, a newly onboarded client), not a job failure BullMQ should
 * retry.
 */
export async function processWeeklyIntelligenceJob(data: WeeklyIntelligenceJobData): Promise<void> {
  const { organizationId, clientId } = data

  const ctx = await resolveAutomationActor(organizationId, clientId)
  if (!ctx) {
    await recordAuditEvent({
      organizationId,
      clientId,
      action: 'workflow.weekly_intelligence.skipped',
      result: 'DENIED',
      error: 'No active employee assigned to this client - nobody to run the automation as.',
    })
    return
  }

  const to = new Date()
  const from = new Date(to.getTime() - RANGE_DAYS * 24 * 60 * 60 * 1000)

  await runAnalyzeClientWorkflow({
    ctx,
    clientId,
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    socialNetwork: DEFAULT_SOCIAL_NETWORK,
    adsChannel: DEFAULT_ADS_CHANNEL,
  })
}

/**
 * Creates the BullMQ `Worker` that actually polls Redis and processes
 * jobs. Only ever run from the standalone worker process
 * (`scripts/worker.ts`) - NOT from the Next.js app itself, which has no
 * long-lived process to host a polling loop in (Vercel serverless
 * functions return after a request; there is no "keep polling Redis in
 * the background" primitive there). See docs/ARCHITECTURE.md's Scheduled
 * Automation section for the full deployment-topology writeup.
 */
export function createWeeklyIntelligenceWorker(): Worker<WeeklyIntelligenceJobData> {
  return new Worker<WeeklyIntelligenceJobData>(
    WEEKLY_INTELLIGENCE_QUEUE_NAME,
    async (job: Job<WeeklyIntelligenceJobData>) => processWeeklyIntelligenceJob(job.data),
    { connection: getRedisConnection(), concurrency: 5 },
  )
}

/**
 * Selects which clients are due for a weekly run right now: opted in via
 * `ClientPolicy.weeklyAutomationEnabled` (BRD Section 65 - "Do not enable
 * all automatically for every client. Use client policies.") AND with no
 * `SUCCEEDED` `analyze_client_performance` `WorkflowRun` in the last 7
 * days (BRD Section 57's idempotency requirement - "has this exact action
 * already succeeded" - a FAILED run does NOT block a retry, an already-
 * successful one does, whether it was this automation or a human's manual
 * "Analyze this client" click within the window). Called by the cron
 * route handler (`src/app/api/cron/weekly-intelligence/route.ts`), kept
 * here (not inline in the route) so it's testable without an HTTP layer.
 */
export async function findClientsDueForWeeklyIntelligence(): Promise<Array<{ organizationId: string; clientId: string }>> {
  const cutoff = new Date(Date.now() - RANGE_DAYS * 24 * 60 * 60 * 1000)

  const optedIn = await db.client.findMany({
    where: { policy: { weeklyAutomationEnabled: true } },
    select: { id: true, organizationId: true },
  })
  if (optedIn.length === 0) return []

  const recentRuns = await db.workflowRun.findMany({
    where: {
      clientId: { in: optedIn.map((c) => c.id) },
      status: 'SUCCEEDED',
      startedAt: { gte: cutoff },
      workflow: { key: 'analyze_client_performance' },
    },
    select: { clientId: true },
  })
  const recentlyRunClientIds = new Set(recentRuns.map((r) => r.clientId))

  return optedIn
    .filter((c) => !recentlyRunClientIds.has(c.id))
    .map((c) => ({ organizationId: c.organizationId, clientId: c.id }))
}
