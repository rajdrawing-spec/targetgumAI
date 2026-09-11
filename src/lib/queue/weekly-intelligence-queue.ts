import { Queue } from 'bullmq'
import { getRedisConnection } from './connection'

/**
 * BullMQ queue for BRD Section 65's "Weekly" scheduled automation - the
 * one cadence BRD Section 85's Phase 2 backlog actually names ("Weekly
 * automated intelligence"). Daily/monthly are deliberately not built yet
 * (see docs/DECISIONS.md) - generalize this into per-cadence queues if/
 * when a second cadence is scheduled, not speculatively now (same
 * "generalize once a second real caller needs the same shape" discipline
 * as `src/lib/workflows/runs.ts`).
 */

export const WEEKLY_INTELLIGENCE_QUEUE_NAME = 'weekly-intelligence'

export interface WeeklyIntelligenceJobData {
  organizationId: string
  clientId: string
}

let queue: Queue<WeeklyIntelligenceJobData> | undefined

export function getWeeklyIntelligenceQueue(): Queue<WeeklyIntelligenceJobData> {
  if (queue) return queue
  queue = new Queue<WeeklyIntelligenceJobData>(WEEKLY_INTELLIGENCE_QUEUE_NAME, { connection: getRedisConnection() })
  return queue
}

/**
 * Enqueues one client's weekly run. `jobId` is the idempotency key BRD
 * Section 57 requires for every scheduled action: `<clientId>-<ISO week>`
 * (BullMQ rejects `:` in a custom job id, hence `-` not `:`) so a cron
 * tick that fires twice for the same week (a retry, an overlapping
 * schedule) is a harmless no-op - BullMQ refuses a duplicate `jobId`
 * outright rather than this module needing its own dedup table.
 */
export async function enqueueWeeklyIntelligenceJob(organizationId: string, clientId: string): Promise<void> {
  const weekStart = new Date()
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
  const isoWeek = weekStart.toISOString().slice(0, 10)

  await getWeeklyIntelligenceQueue().add(
    'weekly-intelligence',
    { organizationId, clientId },
    { jobId: `${clientId}-${isoWeek}`, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
  )
}

/** Test-only: reset the cached queue instance between tests. */
export function resetWeeklyIntelligenceQueueForTests(): void {
  queue = undefined
}
