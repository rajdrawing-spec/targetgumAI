import type { Prisma, WorkflowRunStatus, WorkflowStepStatus } from '@prisma/client'
import { db } from '@/lib/db/client'

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

export async function completeWorkflowRun(workflowRunId: string, status: WorkflowRunStatus, error?: string) {
  return db.workflowRun.update({
    where: { id: workflowRunId },
    data: { status, error, completedAt: new Date() },
  })
}
