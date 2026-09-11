import IORedis from 'ioredis'

/**
 * Shared Redis connection for BullMQ (BRD-PRD Section 65's scheduled
 * automation, Phase 2). `docs/ARCHITECTURE.md`'s stack table has said
 * "Redis + BullMQ" since Day 1; this is the first code to actually use
 * it - see docs/DECISIONS.md for the full account, including why this
 * needed a real Redis instance to build against rather than a mock (a
 * mock queue can't meaningfully prove enqueue/process/retry semantics the
 * way `MetricoolMockProvider` etc. can stand in for an HTTP API).
 *
 * Lazy singleton, same pattern as `src/lib/ai/client.ts`'s Anthropic
 * client - constructed on first use, not at module import time, since
 * REDIS_URL legitimately isn't set in every context that imports this
 * module (Next.js build/typecheck, unit tests that never touch the
 * queue).
 *
 * `maxRetriesPerRequest: null` is BullMQ's own documented requirement for
 * any connection passed to a `Queue`/`Worker` (its internal blocking
 * commands need unlimited retries) - not a general Redis client default.
 */
let connection: IORedis | undefined

export function getRedisConnection(): IORedis {
  if (connection) return connection

  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is not configured. Set it in your environment (see .env.example) before using the queue.')
  }

  connection = new IORedis(url, { maxRetriesPerRequest: null })
  return connection
}

/** Test-only: inject a stand-in connection (e.g. pointed at a disposable test Redis DB index). */
export function setRedisConnectionForTests(mock: IORedis): void {
  connection = mock
}

/** Test-only: reset the cached connection between tests. */
export function resetRedisConnectionForTests(): void {
  connection = undefined
}
