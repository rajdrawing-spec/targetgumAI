import type { Prisma, WorkflowRunStatus, WorkflowStepStatus } from '@prisma/client'
import { db } from '@/lib/db/client'
import { resolveClientAndAdminRecipients, resolveOrgAdminRecipients } from '@/lib/notifications/recipients'
import { notifyRecipients } from '@/lib/notifications/service'

/**
 * Minimal WorkflowRun/WorkflowStep tracking (BRD-PRD Section 23). This is
 * NOT the general Workflow Engine described there (scheduling, delays,
 * retries, pause/resume as a generic state machine) - that's larger,
 * speculative infrastructure with no second caller yet. This is just
 * enough to give one concrete workflow (`src/lib/workflows/
 * analyze-client-workflow.ts`, Day 11) a durable, auditable run record.
 * Generalize when a second real workflow needs the same shape.
 */

export async function getOrCreateWorkflow(
  organizationId: string,
  key: string,
  name: string,
  definition: Prisma.InputJsonValue,
) {
  const existing = await db.workflow.findUnique({ where: { organizationId_key: { organizationId, key } } })
  if (existing) return existing
  return db.workflow.create({ data: { organizationId, key, name, definition } })
}

export async function startWorkflowRun(params: {
  organizationId: string
  clientId?: string
  workflowId: string
  triggeredBy: string
}) {
  return db.workflowRun.create({
    data: {
      organizationId: params.organizationId,
      clientId: params.clientId,
      workflowId: params.workflowId,
      status: 'RUNNING',
      triggeredBy: params.triggeredBy,
      startedAt: new Date(),
    },
  })
}

export async function recordWorkflowStep(
  workflowRunId: string,
  stepKey: string,
  status: WorkflowStepStatus,
  extra: { input?: Prisma.InputJsonValue; output?: Prisma.InputJsonValue; error?: string } = {},
) {
  return db.workflowStep.create({
    data: {
      workflowRunId,
      stepKey,
      status,
      input: extra.input,
      output: extra.output,
      error: extra.error,
      startedAt: new Date(),
      completedAt: status === 'SUCCEEDED' || status === 'FAILED' || status === 'SKIPPED' ? new Date() : undefined,
    },
  })
}

/**
 * Every workflow (analyze-client, SEO, competitor, creative) ends its run
 * through this one function - the "Workflow failure" notification (BRD
 * Section 64) is wired in here so any current or future workflow gets it
 * automatically, not by remembering to add it per workflow.
 */
export async function completeWorkflowRun(workflowRunId: string, status: WorkflowRunStatus, error?: string) {
  const run = await db.workflowRun.update({
    where: { id: workflowRunId },
    data: { status, error, completedAt: new Date() },
    include: { workflow: { select: { name: true } } },
  })

  if (status === 'FAILED') {
    const recipients = run.clientId
      ? await resolveClientAndAdminRecipients(run.organizationId, run.clientId)
      : await resolveOrgAdminRecipients(run.organizationId)
    await notifyRecipients({
      organizationId: run.organizationId,
      clientId: run.clientId ?? undefined,
      recipients,
      type: 'WORKFLOW_FAILED',
      title: `Workflow failed: ${run.workflow.name}`,
      body: error,
      link: run.clientId ? `/dashboard/clients/${run.clientId}` : undefined,
      email: true, // rare enough, and BRD Section 106 treats this as an escalation - never buried in-app only
    })
  }

  return run
}
