import { NextResponse } from 'next/server'
import { enqueueWeeklyIntelligenceJob } from '@/lib/queue/weekly-intelligence-queue'
import { findClientsDueForWeeklyIntelligence } from '@/lib/queue/weekly-intelligence-worker'

/**
 * The scheduling half of BRD Section 65's weekly automation - the half
 * that fits a Vercel serverless function (fast, stateless: look up who's
 * due, enqueue, return). The half that does NOT fit here is actually
 * *processing* those jobs - that needs a long-lived process polling
 * Redis, which is `scripts/worker.ts`, deployed separately (Railway/
 * Render/Fly.io/a small VM - not Vercel). See docs/ARCHITECTURE.md's
 * Scheduled Automation section for the full topology and why.
 *
 * Meant to be called on a schedule by Vercel Cron
 * (https://vercel.com/docs/cron-jobs - a `crons` entry in `vercel.json`
 * pointing at this path, e.g. weekly or daily to catch newly-opted-in
 * clients promptly; `findClientsDueForWeeklyIntelligence`'s own 7-day
 * idempotency window is what actually prevents duplicate runs, not the
 * cron cadence). Vercel signs its own cron requests with this exact
 * `Authorization: Bearer <CRON_SECRET>` header automatically once
 * `CRON_SECRET` is set as an env var - without checking it, anyone who
 * finds this URL could trigger paid AI workflows for every opted-in
 * client (BRD Section 15/116 - never trust an unauthenticated caller with
 * a paid action).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const due = await findClientsDueForWeeklyIntelligence()
  for (const { organizationId, clientId } of due) {
    await enqueueWeeklyIntelligenceJob(organizationId, clientId)
  }

  return NextResponse.json({ enqueued: due.length })
}
