/**
 * Standalone entrypoint for the weekly-intelligence BullMQ worker (BRD
 * Section 65). Run with `npm run worker`. This process is NOT part of the
 * Next.js app - it needs a long-lived host (Railway/Render/Fly.io/a small
 * VM), never Vercel serverless functions, which return after each request
 * and have no "keep polling Redis in the background" primitive. See
 * docs/ARCHITECTURE.md's Scheduled Automation section for the full
 * two-process topology (this worker + the Vercel-hosted app's
 * `/api/cron/weekly-intelligence` route, which only enqueues).
 *
 * Deliberately minimal: construct the worker, log lifecycle events, keep
 * the process alive, shut down cleanly on SIGTERM/SIGINT (so a platform's
 * graceful-shutdown signal doesn't kill an in-flight job mid-AI-call).
 */
import { createWeeklyIntelligenceWorker } from '../src/lib/queue/weekly-intelligence-worker'

const worker = createWeeklyIntelligenceWorker()

worker.on('completed', (job) => {
  console.warn(`[worker] completed job ${job.id} (client ${job.data.clientId})`)
})

worker.on('failed', (job, error) => {
  console.error(`[worker] job ${job?.id} (client ${job?.data.clientId}) failed:`, error)
})

console.warn('[worker] weekly-intelligence worker started, waiting for jobs...')

async function shutdown(signal: string) {
  console.warn(`[worker] received ${signal}, closing gracefully...`)
  await worker.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
